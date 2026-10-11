// 목업 서버가 실제 백엔드 계약(docs/frontend-api-guide.md, backend docs/api)과 같은 모양·오류 코드를 내는지 확인합니다.
import { mockFetch, resetMockDb } from "@/api/mock/server";
import type { AuthResponse, OnboardingQuestions, OnboardingSubmission, RegionList } from "@/api/types";

jest.setTimeout(20000);

const call = async <T = unknown>(method: string, path: string, body?: unknown, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await mockFetch(method, path, body, headers);
  return res as { status: number; json: T };
};

async function signup(email = `u${Date.now()}@test.app`) {
  const res = await call<AuthResponse>("POST", "/auth/signup", { email, password: "password123", nickname: "테스터" });
  return res.json.accessToken;
}

const v2Body = (questions: OnboardingQuestions, answers?: Record<string, 1 | 2>) => ({
  questionVersion: questions.questionVersion,
  travelStyles: { 1: 2, 3: 4, 5: 6, 6: 3 },
  travelMotives: [2, 7],
  likedRegions: ["51150"],
  scheduleDensity: "RELAXED",
  excludeTags: ["물놀이"],
  ...(answers ? { mbtiAnswers: answers } : {}),
});

beforeEach(async () => {
  await resetMockDb();
});

describe("온보딩 v2", () => {
  it("문항은 aihub-traveler-v2이고 MBTI 12문항에 글자 매핑이 없습니다", async () => {
    const { json } = await call<OnboardingQuestions>("GET", "/onboarding/questions");
    expect(json.questionVersion).toBe("aihub-traveler-v2");
    expect(json.mbtiQuestions).toHaveLength(12);
    expect(JSON.stringify(json.mbtiQuestions)).not.toMatch(/"letter"/);
  });

  it("MBTI 답이 빠지면 ONBOARDING_MISSING_QUESTION_ANSWER", async () => {
    const token = await signup();
    const { json: q } = await call<OnboardingQuestions>("GET", "/onboarding/questions");
    const res = await call<{ code: string }>("POST", "/onboarding/submissions", v2Body(q, { 1: 1 }), token);
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("ONBOARDING_MISSING_QUESTION_ANSWER");
  });

  it("12문항을 다 답하면 서버가 mbtiCode를 계산하고, 응답에는 excludeTags가 없습니다", async () => {
    const token = await signup();
    const { json: q } = await call<OnboardingQuestions>("GET", "/onboarding/questions");
    const answers = Object.fromEntries(q.mbtiQuestions!.map((m) => [String(m.number), 1 as const]));
    const res = await call<OnboardingSubmission>("POST", "/onboarding/submissions", v2Body(q, answers), token);
    expect(res.status).toBe(201);
    expect(res.json.mbtiCode).toMatch(/^[EI][SN][TF][JP]$/);
    expect(res.json).not.toHaveProperty("excludeTags");
    const me = await call<{ onboardingCompleted: boolean }>("GET", "/users/me", undefined, token);
    expect(me.json.onboardingCompleted).toBe(true);
  });

  it("호환 버전 v1은 MBTI 없이 받고 mbtiCode는 null", async () => {
    const token = await signup();
    const { json: q } = await call<OnboardingQuestions>("GET", "/onboarding/questions");
    const res = await call<OnboardingSubmission>("POST", "/onboarding/submissions", { ...v2Body(q), questionVersion: "aihub-traveler-v1" }, token);
    expect(res.status).toBe(201);
    expect(res.json.mbtiCode).toBeNull();
  });
});

describe("카카오 로그인", () => {
  it("처음엔 201 소셜 전용 회원(email null), 다시 오면 200", async () => {
    const body = { code: "kakao-123", redirectUri: "http://localhost:5173/auth/kakao/callback" };
    const first = await call<AuthResponse>("POST", "/auth/kakao", body);
    expect(first.status).toBe(201);
    expect(first.json.user.email).toBeNull();
    expect(first.json.onboardingCompleted).toBe(false);
    const second = await call<AuthResponse>("POST", "/auth/kakao", body);
    expect(second.status).toBe(200);
    expect(second.json.user.id).toBe(first.json.user.id);
    const me = await call<{ loginMethods: string[] }>("GET", "/users/me", undefined, second.json.accessToken);
    expect(me.json.loginMethods).toEqual(["KAKAO"]);
  });
});

describe("지역·여행", () => {
  it("일수가 길수록 추첨 가능 지역이 줄고, days 없이 부르면 추첨 필드가 null", async () => {
    const token = await signup();
    const counts = [];
    for (const days of [1, 3, 7]) {
      const { json } = await call<RegionList>("GET", `/regions?days=${days}`, undefined, token);
      counts.push(json.eligibleCount!);
    }
    expect(counts[0]).toBeGreaterThan(counts[1]);
    expect(counts[1]).toBeGreaterThan(counts[2]);
    const all = await call<RegionList>("GET", "/regions", undefined, token);
    expect(all.json.regions).toHaveLength(250);
    expect(all.json.regions[0].drawEligible).toBeNull();
  });

  it("설문 전에는 여행을 못 만들고(409), 겹치는 날짜는 TRIP_DATE_OVERLAP", async () => {
    const token = await signup();
    const start = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const before = await call<{ code: string }>("POST", "/trips", { startDate: start, nights: 1, transport: "WALK" }, token);
    expect(before.json.code).toBe("ONBOARDING_REQUIRED");

    const { json: q } = await call<OnboardingQuestions>("GET", "/onboarding/questions");
    const answers = Object.fromEntries(q.mbtiQuestions!.map((m) => [String(m.number), 2 as const]));
    await call("POST", "/onboarding/submissions", v2Body(q, answers), token);
    const created = await call<{ id: number; version: number }>("POST", "/trips", { startDate: start, nights: 1, transport: "WALK" }, token);
    expect(created.status).toBe(201);
    const overlap = await call<{ code: string }>("POST", "/trips", { startDate: start, nights: 0, transport: "WALK" }, token);
    expect(overlap.json.code).toBe("TRIP_DATE_OVERLAP");

    const region = await call<{ regionSigCd: string; version: number }>(
      "POST",
      `/trips/${created.json.id}/region`,
      { mode: "MANUAL", sigCd: "51150", version: created.json.version },
      token,
    );
    expect(region.json.regionSigCd).toBe("51150");
    expect(region.json.version).toBe(created.json.version + 1);
  });
});
