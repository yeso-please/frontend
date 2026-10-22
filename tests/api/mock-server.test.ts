// 목업 서버가 실제 백엔드 계약(backend docs/api/*.md, docs/frontend-guide.md)과 같은 모양·오류 코드를 내는지 확인합니다.
import { mockFetch, resetMockDb } from "@/api/mock/server";
import type {
  Alternatives,
  AuthResponse,
  Course,
  CourseRoutes,
  DrawResult,
  OnboardingQuestions,
  OnboardingSubmission,
  Participant,
  Presence,
  ReceivedInvite,
  RegionCard,
  RegionList,
  RegionMatch,
  RestaurantRecommendations,
  TripContext,
  TripSummary,
} from "@/api/types";
import personas from "@/features/mbti/travel-personas.json";

jest.setTimeout(20000);

type Res<T> = { status: number; json: T };
const call = async <T = { code: string }>(method: string, path: string, body?: unknown, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return (await mockFetch(method, path, body, headers)) as Res<T>;
};

let seq = 0;
async function signup(nickname = "테스터") {
  seq += 1;
  const res = await call<AuthResponse>("POST", "/auth/signup", { email: `u${Date.now()}-${seq}@test.app`, password: "password123", nickname });
  return res.json.accessToken;
}

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** v2 설문 본문 (scheduleDensity는 보내지 않습니다 — 서버가 J/P로 정함) */
const v2Body = (questions: OnboardingQuestions, answers?: Record<string, 1 | 2>) => ({
  questionVersion: questions.questionVersion,
  travelStyles: { 1: 2, 3: 4, 5: 6, 6: 3 },
  travelMotives: [2, 7],
  likedRegions: [],
  excludeTags: ["물놀이"],
  ...(answers ? { mbtiAnswers: answers } : {}),
});

/** 가입 + v2 설문 완료. choice 1은 P 쪽이 많고 2는 J 쪽이 많습니다(목업 문항 매핑) */
async function onboarded(nickname = "테스터", choice: 1 | 2 = 1) {
  const token = await signup(nickname);
  const { json: q } = await call<OnboardingQuestions>("GET", "/onboarding/questions");
  const answers = Object.fromEntries(q.mbtiQuestions!.map((m) => [String(m.number), choice]));
  const res = await call<OnboardingSubmission>("POST", "/onboarding/submissions", v2Body(q, answers), token);
  return { token, submission: res.json };
}

async function createTrip(token: string, body: Record<string, unknown>) {
  return call<TripContext>("POST", "/trips", { startDate: inDays(10), nights: 1, ...body }, token);
}

/** 지역이 정해진 여행 + 첫 코스 */
async function tripWithCourse(token: string, startOffset = 10, nights = 1) {
  const trip = (await createTrip(token, { startDate: inDays(startOffset), nights, regionSigCd: "51150", regionSelection: "RANDOM" })).json;
  const course = await call<Course>("POST", `/courses/${trip.id}/generate`, { version: trip.version }, token);
  return { trip, course: course.json };
}

const attractions = (course: Course, dayIndex = 0) => course.days[dayIndex].items.filter((i) => i.type === "ATTRACTION");

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
    const res = await call("POST", "/onboarding/submissions", v2Body(q, { 1: 1 }), token);
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("ONBOARDING_MISSING_QUESTION_ANSWER");
  });

  it("12문항을 다 답하면 서버가 mbtiCode를 계산하고, 응답에는 excludeTags가 없습니다", async () => {
    const { token, submission } = await onboarded();
    expect(submission.mbtiCode).toMatch(/^[EI][SN][TF][JP]$/);
    expect(submission).not.toHaveProperty("excludeTags");
    const me = await call<{ onboardingCompleted: boolean }>("GET", "/users/me", undefined, token);
    expect(me.json.onboardingCompleted).toBe(true);
  });

  it("일정 밀도는 묻지 않고 MBTI J → PACKED, P → RELAXED로 정합니다 (D3-2)", async () => {
    const p = await onboarded("P형", 1);
    expect(p.submission.mbtiCode?.[3]).toBe("P");
    expect(p.submission.scheduleDensity).toBe("RELAXED");
    const j = await onboarded("J형", 2);
    expect(j.submission.mbtiCode?.[3]).toBe("J");
    expect(j.submission.scheduleDensity).toBe("PACKED");
  });

  it("호환 버전 v1은 MBTI 없이 받고 mbtiCode는 null, 밀도는 RELAXED", async () => {
    const token = await signup();
    const { json: q } = await call<OnboardingQuestions>("GET", "/onboarding/questions");
    const res = await call<OnboardingSubmission>("POST", "/onboarding/submissions", { ...v2Body(q), questionVersion: "aihub-traveler-v1" }, token);
    expect(res.status).toBe(201);
    expect(res.json.mbtiCode).toBeNull();
    expect(res.json.scheduleDensity).toBe("RELAXED");
  });

  it("코스 생성 기본 취향 설정은 TASTE이고 RANDOM으로 바꿀 수 있습니다 (2-11·2-12)", async () => {
    const token = await signup();
    expect((await call<{ courseTasteMode: string }>("GET", "/me/preferences", undefined, token)).json.courseTasteMode).toBe("TASTE");
    expect((await call<{ courseTasteMode: string }>("PATCH", "/me/preferences", { courseTasteMode: "RANDOM" }, token)).json.courseTasteMode).toBe("RANDOM");
    const bad = await call("PATCH", "/me/preferences", { courseTasteMode: "MIX" }, token);
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe("COMMON_INVALID_REQUEST");
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

describe("지역 먼저 뽑기 (7-5)·지역 카드 (7-2)·맞춤 문장 (7-6)", () => {
  it("RANDOM은 1일 기준 추첨 가능 지역에서 뽑고 최대 박수(0~6)를 함께 줍니다", async () => {
    const { token } = await onboarded();
    const { json: eligible } = await call<RegionList>("GET", "/regions?days=1", undefined, token);
    const res = await call<DrawResult>("POST", "/regions/draw", { mode: "RANDOM" }, token);
    expect(res.status).toBe(200);
    expect(res.json.regionSelection).toBe("RANDOM");
    expect(res.json.maxNights).toBeGreaterThanOrEqual(0);
    expect(res.json.maxNights).toBeLessThanOrEqual(6);
    expect(eligible.regions.find((r) => r.sigCd === res.json.sigCd)?.drawEligible).toBe(true);
  });

  it("조건 뽑기: 조건이 없으면 400, 출발지 없는 거리 조건은 ORIGIN_MISSING으로 무시, 출발지 짝이 없으면 400", async () => {
    const { token } = await onboarded();
    expect((await call("POST", "/regions/draw", { mode: "CONDITIONAL", conditions: [] }, token)).json.code).toBe("DRAW_NO_CONDITION_SELECTED");
    expect((await call("POST", "/regions/draw", { mode: "MANUAL" }, token)).json.code).toBe("DRAW_INVALID_MODE");
    expect((await call("POST", "/regions/draw", { mode: "RANDOM", originLat: 37.5 }, token)).json.code).toBe("TRIP_INVALID_ORIGIN");

    const res = await call<DrawResult>("POST", "/regions/draw", { mode: "CONDITIONAL", conditions: ["DISTANCE", "MY_TASTE"] }, token);
    expect(res.status).toBe(200);
    expect(res.json.regionSelection).toBe("CONDITIONAL");
    expect(res.json.appliedConditions).toEqual(["MY_TASTE"]);
    expect(res.json.ignoredConditions).toEqual([{ condition: "DISTANCE", reason: "ORIGIN_MISSING" }]);

    const near = await call<DrawResult>("POST", "/regions/draw", { mode: "CONDITIONAL", conditions: ["DISTANCE"], originLat: 37.5665, originLng: 126.978 }, token);
    expect(near.json.appliedConditions).toEqual(["DISTANCE"]);
  });

  it("지역 카드는 한 줄 소개·태그·만나볼 순간 3곳(oneLine)을 줍니다", async () => {
    const token = await signup();
    const { json } = await call<RegionCard>("GET", "/regions/51150/card", undefined, token);
    expect(json.tagline).toEqual(expect.any(String));
    expect(json.tags.length).toBeGreaterThan(0);
    expect(json.landmarks).toHaveLength(3);
    expect(json.landmarks[0].oneLine).toEqual(expect.any(String));
    expect((await call("GET", "/regions/00000/card", undefined, token)).json.code).toBe("REGION_NOT_FOUND");
  });

  it("맞춤 문장: 설문 전엔 모두 null, v2 설문 뒤엔 성향 이름(travel-personas.json)과 규칙 문장", async () => {
    const before = await signup();
    const empty = await call<RegionMatch>("GET", "/regions/51150/match", undefined, before);
    expect(empty.json).toMatchObject({ mbtiCode: null, personaName: null, text: null, aiGenerated: false });

    const { token, submission } = await onboarded();
    const { json } = await call<RegionMatch>("GET", "/regions/51150/match", undefined, token);
    expect(json.mbtiCode).toBe(submission.mbtiCode);
    expect(json.personaName).toBe(personas.types.find((p) => p.code === submission.mbtiCode)?.name);
    expect(json.textSource).toBe("RULE");
    expect(json.text).toMatch(/강릉/);
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
    const start = inDays(10);
    const before = await call("POST", "/trips", { startDate: start, nights: 1 }, token);
    expect(before.json.code).toBe("ONBOARDING_REQUIRED");

    const { json: q } = await call<OnboardingQuestions>("GET", "/onboarding/questions");
    const answers = Object.fromEntries(q.mbtiQuestions!.map((m) => [String(m.number), 2 as const]));
    await call("POST", "/onboarding/submissions", v2Body(q, answers), token);
    const created = await call<TripContext>("POST", "/trips", { startDate: start, nights: 1, transport: "WALK" }, token);
    expect(created.status).toBe(201);
    const overlap = await call<{ code: string; details: { conflicts: unknown[] } }>("POST", "/trips", { startDate: start, nights: 0 }, token);
    expect(overlap.json.code).toBe("TRIP_DATE_OVERLAP");
    expect(overlap.json.details.conflicts).toHaveLength(1);

    const region = await call<{ regionSigCd: string; version: number }>(
      "POST",
      `/trips/${created.json.id}/region`,
      { mode: "MANUAL", sigCd: "51150", version: created.json.version },
      token,
    );
    expect(region.json.regionSigCd).toBe("51150");
    expect(region.json.version).toBe(created.json.version + 1);
  });

  it("지역과 함께 여행을 만들면 이동수단은 CAR, 밀도는 설문 값, 방식은 그대로 저장됩니다 (3-3)", async () => {
    const { token, submission } = await onboarded();
    const res = await createTrip(token, { regionSigCd: "51150", regionSelection: "RANDOM" });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      transport: "CAR",
      regionSigCd: "51150",
      regionSelection: "RANDOM",
      scheduleDensity: submission.scheduleDensity,
      hasCourse: false,
      retroactive: false,
    });
    const [summary] = (await call<TripSummary[]>("GET", "/trips?period=UPCOMING", undefined, token)).json;
    expect(summary.regionName).toBe("강원특별자치도 강릉시");
    expect(summary.title).toMatch(/1박 2일 여행$/);
  });

  it("지난 날짜로 만들면 사후 기록 여행(retroactive)이 됩니다", async () => {
    const { token } = await onboarded();
    const res = await createTrip(token, { startDate: inDays(-5), nights: 1 });
    expect(res.status).toBe(201);
    expect(res.json.retroactive).toBe(true);
  });

  it("그 기간에 코스를 못 만드는 지역은 확인 API가 regionEligible false, 만들기는 422이고 여행이 생기지 않습니다", async () => {
    const { token } = await onboarded("P형", 1);
    const { json } = await call<RegionList>("GET", "/regions?days=7", undefined, token);
    const short = json.regions.find((r) => !r.drawEligible)!.sigCd;

    const ok = await call<{ regionEligible: boolean }>("POST", "/trips/context/check", { startDate: inDays(10), nights: 0, sigCd: "51150" }, token);
    expect(ok.json.regionEligible).toBe(true);
    const noRegion = await call<{ regionEligible: boolean | null }>("POST", "/trips/context/check", { startDate: inDays(10), nights: 0 }, token);
    expect(noRegion.json.regionEligible).toBeNull();
    const check = await call<{ regionEligible: boolean }>("POST", "/trips/context/check", { startDate: inDays(10), nights: 6, sigCd: short }, token);
    expect(check.json.regionEligible).toBe(false);

    const res = await createTrip(token, { nights: 6, regionSigCd: short });
    expect(res.status).toBe(422);
    expect((res.json as unknown as { code: string }).code).toBe("DRAW_REGION_NOT_ELIGIBLE");
    expect((await call<TripSummary[]>("GET", "/trips", undefined, token)).json).toHaveLength(0);
  });

  it("코스가 있는 여행의 지역을 바꾸려면 replaceCourse가 필요하고, 바꾸면 코스가 비워집니다 (3-7)", async () => {
    const { token } = await onboarded();
    const { trip, course } = await tripWithCourse(token);
    const locked = await call("POST", `/trips/${trip.id}/region`, { mode: "MANUAL", sigCd: "47130", version: course.version }, token);
    expect(locked.json.code).toBe("TRIP_CONTEXT_LOCKED");
    const replaced = await call<{ version: number }>("POST", `/trips/${trip.id}/region`, { mode: "MANUAL", sigCd: "47130", replaceCourse: true, version: course.version }, token);
    expect(replaced.status).toBe(200);
    expect((await call("GET", `/courses/${trip.id}`, undefined, token)).json.code).toBe("COURSE_NOT_FOUND");
    expect((await call<TripContext>("GET", `/trips/${trip.id}/context`, undefined, token)).json.hasCourse).toBe(false);
  });
});

describe("코스 생성·조회 (5-1·5-2)", () => {
  it("지역 전·버전 불일치는 막고, 코스가 없으면 404", async () => {
    const { token } = await onboarded();
    const noRegion = (await createTrip(token, {})).json;
    expect((await call("POST", `/courses/${noRegion.id}/generate`, { version: noRegion.version }, token)).json.code).toBe("TRIP_REGION_NOT_SELECTED");

    const trip = (await createTrip(token, { startDate: inDays(20), regionSigCd: "51150" })).json;
    expect((await call("GET", `/courses/${trip.id}`, undefined, token)).json.code).toBe("COURSE_NOT_FOUND");
    expect((await call("POST", `/courses/${trip.id}/generate`, { version: trip.version + 5 }, token)).json.code).toBe("TRIP_VERSION_CONFLICT");
    expect((await call("POST", `/courses/${trip.id}/generate`, { version: trip.version, tasteMode: "MIX" }, token)).json.code).toBe("COMMON_INVALID_REQUEST");
  });

  it("날마다 점심·저녁이 하나씩, 첫 지점은 이동 null, 이후엔 세 수단 직선 추정, 모든 장소는 기본 추천", async () => {
    const { token } = await onboarded();
    const trip = (await createTrip(token, { nights: 2, regionSigCd: "51150", regionSelection: "RANDOM" })).json;
    const res = await call<Course>("POST", `/courses/${trip.id}/generate`, { version: trip.version }, token);
    expect(res.status).toBe(201);
    const course = res.json;
    expect(course.version).toBe(trip.version + 1);
    expect(course.myRole).toBe("PARTICIPANT");
    expect(course.days).toHaveLength(3);
    expect(course.titleSource).toBe("RULE");
    expect(course.tasteBasis?.nickname).toBe("테스터");
    expect(course.warnings.map((w) => w.code)).toContain("ROUTE_TIME_ESTIMATED");
    expect(course.changes).toMatchObject({ removed: [], latest: null });

    for (const day of course.days) {
      expect(day.items.filter((i) => i.type === "MEAL").map((i) => (i.type === "MEAL" ? i.meal : null))).toEqual(["LUNCH", "DINNER"]);
      expect(day.items[day.items.length - 1]).toMatchObject({ type: "MEAL", meal: "DINNER" });
      expect(day.items[0].travelFromPrevious).toBeNull();
      const second = attractions(course, day.dayIndex)[1];
      expect(second.travelFromPrevious).toMatchObject({ carSource: "STRAIGHT", walkSource: "STRAIGHT", transitSource: "STRAIGHT", estimated: true });
      expect(second.travelFromPrevious!.walkMinutes).toBeGreaterThanOrEqual(second.travelFromPrevious!.carMinutes);
      attractions(course, day.dayIndex).forEach((a) => expect(a.type === "ATTRACTION" && a.change.origin).toBe("BASE"));
    }

    const context = await call<TripContext>("GET", `/trips/${trip.id}/context`, undefined, token);
    expect(context.json).toMatchObject({ hasCourse: true, version: course.version });
    const fetched = await call<Course>("GET", `/courses/${trip.id}`, undefined, token);
    expect(fetched.json.days[0].items.map((i) => i.itemId)).toEqual(course.days[0].items.map((i) => i.itemId));
  });

  it("완전 랜덤을 고르면 recommendationMode RANDOM이고 추천 이유가 없습니다", async () => {
    const { token } = await onboarded();
    const trip = (await createTrip(token, { regionSigCd: "51150" })).json;
    const { json } = await call<Course>("POST", `/courses/${trip.id}/generate`, { version: trip.version, tasteMode: "RANDOM" }, token);
    expect(json.recommendationMode).toBe("RANDOM");
    expect(attractions(json).every((a) => a.type === "ATTRACTION" && a.reason === null)).toBe(true);
  });

  it("경로(5-7)는 지점 사이 직선 구간이고 범위 밖 dayIndex는 400", async () => {
    const { token } = await onboarded();
    const { trip, course } = await tripWithCourse(token);
    const points = course.days[0].items.filter((i) => i.type === "ATTRACTION" || i.restaurant !== null);
    const { json } = await call<CourseRoutes>("GET", `/courses/${trip.id}/routes?dayIndex=0&transport=WALK`, undefined, token);
    expect(json.transport).toBe("WALK");
    expect(json.legs).toHaveLength(points.length - 1);
    expect(json.legs[0]).toMatchObject({ source: "STRAIGHT", fromItemId: points[0].itemId, toItemId: points[1].itemId });
    expect(json.legs[0].path).toHaveLength(2);
    expect((await call("GET", `/courses/${trip.id}/routes?dayIndex=9`, undefined, token)).json.code).toBe("COMMON_INVALID_REQUEST");
  });
});

describe("코스 편집 (5-3)·대체 후보 (5-4)·식당 (5-5)", () => {
  it("빼기 → 변경 기록, 다시 넣기 → 기본 추천으로 돌아옵니다", async () => {
    const { token } = await onboarded("민지");
    const { trip, course } = await tripWithCourse(token);
    const target = attractions(course)[0];

    const removed = await call<Course>("PATCH", `/courses/${trip.id}/schedule`, { version: course.version, operations: [{ op: "REMOVE", itemId: target.itemId, note: "너무 멀어요" }] }, token);
    expect(removed.status).toBe(200);
    expect(removed.json.version).toBe(course.version + 1);
    expect(removed.json.updatedBy?.nickname).toBe("민지");
    const record = removed.json.changes!.removed[0];
    expect(record).toMatchObject({ dayIndex: 0, origin: "BASE", note: "너무 멀어요", removedBy: { nickname: "민지" } });
    expect(removed.json.changes!.latest).toMatchObject({ type: "REMOVED", by: { nickname: "민지" } });
    expect(removed.json.changes!.days[0].removed).toBe(1);

    const restored = await call<Course>("PATCH", `/courses/${trip.id}/schedule`, { version: removed.json.version, operations: [{ op: "RESTORE", removalId: record.removalId, position: 0 }] }, token);
    expect(restored.json.changes!.removed).toEqual([]);
    expect(restored.json.changes!.latest?.type).toBe("RESTORED");
    expect(restored.json.days[0].items[0]).toMatchObject({ type: "ATTRACTION", attractionId: target.type === "ATTRACTION" ? target.attractionId : -1, change: { origin: "BASE" } });

    const again = await call("PATCH", `/courses/${trip.id}/schedule`, { version: restored.json.version, operations: [{ op: "RESTORE", removalId: record.removalId }] }, token);
    expect(again.json.code).toBe("COURSE_REMOVAL_NOT_FOUND");
  });

  it("교체는 처음 기준 장소를 replacedFrom으로, 추가는 ADDED로 남깁니다", async () => {
    const { token } = await onboarded("서현");
    const { trip, course } = await tripWithCourse(token);
    const target = attractions(course)[0];
    if (target.type !== "ATTRACTION") throw new Error("관광지가 아님");

    const { json: alt } = await call<Alternatives>("GET", `/courses/${trip.id}/alternatives?itemId=${target.itemId}&limit=5`, undefined, token);
    expect(alt.itemId).toBe(target.itemId);
    const candidates = alt.groups.flatMap((g) => g.items);
    expect(candidates.length).toBeGreaterThan(1);
    const inCourse = new Set(course.days.flatMap((d) => d.items).flatMap((i) => (i.type === "ATTRACTION" ? [i.attractionId] : [])));
    expect(candidates.some((c) => inCourse.has(c.attractionId))).toBe(false);

    const replaced = await call<Course>(
      "PATCH",
      `/courses/${trip.id}/schedule`,
      {
        version: course.version,
        operations: [
          { op: "REPLACE", itemId: target.itemId, attractionId: candidates[0].attractionId, note: "노을 보러 가요" },
          { op: "ADD", dayIndex: 0, position: 1, attractionId: candidates[1].attractionId },
        ],
      },
      token,
    );
    expect(replaced.status).toBe(200);
    const [first, second] = replaced.json.days[0].items;
    expect(first).toMatchObject({
      itemId: target.itemId,
      attractionId: candidates[0].attractionId,
      source: "MANUAL",
      change: { origin: "REPLACED", replacedFrom: { attractionId: target.attractionId, name: target.name }, note: "노을 보러 가요", by: { nickname: "서현" } },
    });
    expect(second).toMatchObject({ attractionId: candidates[1].attractionId, change: { origin: "ADDED" } });
    expect(replaced.json.changes!.days[0]).toMatchObject({ added: 1, replaced: 1 });
    expect(replaced.json.changes!.latest?.type).toBe("ADDED");

    // 이미 코스에 있는 장소는 409
    const dup = await call("PATCH", `/courses/${trip.id}/schedule`, { version: replaced.json.version, operations: [{ op: "ADD", dayIndex: 0, attractionId: candidates[0].attractionId }] }, token);
    expect(dup.json.code).toBe("ATTRACTION_ALREADY_IN_COURSE");
    // 검색어로 후보를 좁힙니다
    const { json: searched } = await call<Alternatives>(`GET`, `/courses/${trip.id}/alternatives?q=${encodeURIComponent("없는이름")}`, undefined, token);
    expect(searched.groups).toEqual([]);
  });

  it("여러 operation은 전부 적용되거나 전부 거부되고, 오래된 버전은 409", async () => {
    const { token } = await onboarded();
    const { trip, course } = await tripWithCourse(token, 10, 1);
    const target = attractions(course)[0];
    const lunch = course.days[0].items.find((i) => i.type === "MEAL")!;

    const rejected = await call(
      "PATCH",
      `/courses/${trip.id}/schedule`,
      { version: course.version, operations: [{ op: "REMOVE", itemId: target.itemId }, { op: "MOVE", itemId: lunch.itemId, dayIndex: 1, position: 0 }] },
      token,
    );
    expect(rejected.status).toBe(400);
    expect(rejected.json.code).toBe("COURSE_INVALID_OPERATION");
    const unchanged = await call<Course>("GET", `/courses/${trip.id}`, undefined, token);
    expect(unchanged.json.version).toBe(course.version);
    expect(unchanged.json.changes!.removed).toEqual([]);

    expect((await call("PATCH", `/courses/${trip.id}/schedule`, { version: course.version, operations: [{ op: "REMOVE", itemId: lunch.itemId }] }, token)).json.code).toBe("COURSE_INVALID_OPERATION");
    expect((await call("PATCH", `/courses/${trip.id}/schedule`, { version: course.version, operations: [{ op: "REMOVE", itemId: "a-999" }] }, token)).json.code).toBe("COURSE_ITEM_NOT_FOUND");
    expect((await call("PATCH", `/courses/${trip.id}/schedule`, { version: course.version, operations: [] }, token)).json.code).toBe("COURSE_INVALID_OPERATION");

    const moved = await call<Course>(
      "PATCH",
      `/courses/${trip.id}/schedule`,
      { version: course.version, operations: [{ op: "MOVE", itemId: target.itemId, dayIndex: 1, position: 0 }] },
      token,
    );
    expect(moved.json.days[1].items[0].itemId).toBe(target.itemId);
    const stale = await call("PATCH", `/courses/${trip.id}/schedule`, { version: course.version, operations: [{ op: "MOVE", itemId: target.itemId, dayIndex: 0, position: 0 }] }, token);
    expect(stale.status).toBe(409);
    expect(stale.json.code).toBe("TRIP_VERSION_CONFLICT");
  });

  it("식당 추천 토큰으로 식사 슬롯을 정하고 해제하며, 다른 슬롯 토큰은 422", async () => {
    const { token } = await onboarded();
    const { trip, course } = await tripWithCourse(token);
    const [lunch, dinner] = course.days[0].items.filter((i) => i.type === "MEAL");

    const { json: recs } = await call<RestaurantRecommendations>("GET", `/courses/${trip.id}/restaurants/recommendations?itemId=${lunch.itemId}&radius=20000`, undefined, token);
    expect(recs.sections.map((s) => s.source)).toEqual(["TOUR_API", "FARM_RESTAURANT", "MODEL_RESTAURANT", "GOOD_PRICE"]);
    expect(recs.origin.type).toBe("PREVIOUS_ATTRACTION");
    const pick = recs.sections[0].items[0];
    expect(pick.selectionToken).toMatch(/^rs_/);

    const set = await call<Course>("PATCH", `/courses/${trip.id}/schedule`, { version: course.version, operations: [{ op: "SET_RESTAURANT", itemId: lunch.itemId, selectionToken: pick.selectionToken }] }, token);
    expect(set.json.days[0].items.find((i) => i.itemId === lunch.itemId)).toMatchObject({ restaurant: { name: pick.name, provider: "TOUR_API" } });

    const wrongSlot = await call("PATCH", `/courses/${trip.id}/schedule`, { version: set.json.version, operations: [{ op: "SET_RESTAURANT", itemId: dinner.itemId, selectionToken: pick.selectionToken }] }, token);
    expect(wrongSlot.json.code).toBe("COURSE_RESTAURANT_SELECTION_INVALID");

    const cleared = await call<Course>("PATCH", `/courses/${trip.id}/schedule`, { version: set.json.version, operations: [{ op: "CLEAR_RESTAURANT", itemId: lunch.itemId }] }, token);
    expect(cleared.json.days[0].items.find((i) => i.itemId === lunch.itemId)).toMatchObject({ restaurant: null, travelFromPrevious: null });
    expect((await call("GET", `/courses/${trip.id}/restaurants/recommendations?itemId=${attractions(course)[0].itemId}`, undefined, token)).json.code).toBe("COURSE_INVALID_OPERATION");
  });
});

describe("초대·참여자 (4장·3-8~3-12)", () => {
  it("받은 초대(4-7): 시연용 친구 여행 초대가 있고, 수락하면 목록에서 빠지고 여행·코스를 볼 수 있습니다", async () => {
    const { token } = await onboarded();
    const { json: invites } = await call<ReceivedInvite[]>("GET", "/me/trip-invites", undefined, token);
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({ inviter: { nickname: "민지" }, dateConflict: false, trip: { regionName: "강원특별자치도 강릉시" } });
    expect(invites[0].trip.participants.map((p) => p.nickname)).toEqual(["민지", "서현"]);

    const accepted = await call<TripContext>("POST", `/me/trip-invites/${invites[0].id}/accept`, undefined, token);
    expect(accepted.status).toBe(201);
    expect((await call<ReceivedInvite[]>("GET", "/me/trip-invites", undefined, token)).json).toEqual([]);
    expect((await call("POST", `/me/trip-invites/${invites[0].id}/accept`, undefined, token)).json.code).toBe("INVITE_ALREADY_HANDLED");
    const course = await call<Course>("GET", `/courses/${accepted.json.id}`, undefined, token);
    expect(course.status).toBe(200);
    expect(course.json.tasteBasis?.nickname).toBe("민지");
  });

  it("날짜가 겹치면 dateConflict true이고 수락은 TRIP_DATE_OVERLAP, 거절은 204", async () => {
    const { token } = await onboarded();
    const [invite] = (await call<ReceivedInvite[]>("GET", "/me/trip-invites", undefined, token)).json;
    await createTrip(token, { startDate: invite.trip.startDate, nights: 0 });
    const [again] = (await call<ReceivedInvite[]>("GET", "/me/trip-invites", undefined, token)).json;
    expect(again.dateConflict).toBe(true);
    expect((await call("POST", `/me/trip-invites/${invite.id}/accept`, undefined, token)).json.code).toBe("TRIP_DATE_OVERLAP");
    expect((await call("POST", `/me/trip-invites/${invite.id}/decline`, undefined, token)).status).toBe(204);
    expect((await call<ReceivedInvite[]>("GET", "/me/trip-invites", undefined, token)).json).toEqual([]);
  });

  it("초대 링크: 미리보기·둘러보기는 로그인 없이, 수락은 201 다음엔 200, 첫 코스는 만든 사람만", async () => {
    const a = await onboarded("수정");
    const b = await onboarded("민지");
    const trip = (await createTrip(a.token, { startDate: inDays(30), regionSigCd: "51150", regionSelection: "RANDOM" })).json;
    const { json: link } = await call<{ token: string }>("POST", `/trips/${trip.id}/invites`, { expiresInDays: 7 }, a.token);

    const preview = await call<{ participants: { nickname: string }[]; hasCourse: boolean; inviterNickname: string; regionSigCd: string }>("GET", `/invites/${link.token}`);
    expect(preview.json).toMatchObject({ participants: [{ nickname: "수정" }], hasCourse: false, inviterNickname: "수정", regionSigCd: "51150" });
    const emptyCourse = await call<Course>("GET", `/invites/${link.token}/course`);
    expect(emptyCourse.json).toMatchObject({ myRole: "VIEWER", days: [], changes: null });
    expect((await call("GET", "/invites/sl_wrong")).json.code).toBe("TOKEN_AUDIENCE_MISMATCH");
    expect((await call("GET", "/invites/iv_unknown")).json.code).toBe("INVITE_NOT_FOUND");

    expect((await call<TripContext>("POST", `/invites/${link.token}/accept`, undefined, b.token)).status).toBe(201);
    expect((await call<TripContext>("POST", `/invites/${link.token}/accept`, undefined, b.token)).status).toBe(200);
    const { json: participants } = await call<Participant[]>("GET", `/trips/${trip.id}/participants`, undefined, b.token);
    expect(participants.map((p) => [p.nickname, p.isCreator, p.isManager])).toEqual([
      ["수정", true, true],
      ["민지", false, false],
    ]);

    expect((await call("POST", `/courses/${trip.id}/generate`, { version: trip.version }, b.token)).json.code).toBe("COURSE_CREATOR_ONLY");
    const generated = await call<Course>("POST", `/courses/${trip.id}/generate`, { version: trip.version }, a.token);
    expect(generated.status).toBe(201);
    // 재생성은 참여자 누구나
    expect((await call<Course>("POST", `/courses/${trip.id}/generate`, { version: generated.json.version }, b.token)).status).toBe(201);
    const viewer = await call<Course>("GET", `/invites/${link.token}/course`);
    expect(viewer.json.myRole).toBe("VIEWER");
    expect(viewer.json.days.length).toBeGreaterThan(0);
    expect(viewer.json.tasteBasis?.nickname).toBe("민지");
  });

  it("보낸 친구 초대(4-14)에는 보낸 사람이 있고, 대기 중인 초대는 멱등입니다", async () => {
    const { token } = await onboarded("수정");
    const trip = (await createTrip(token, { regionSigCd: "51150" })).json;
    const first = await call<{ id: number; status: string }>("POST", `/trips/${trip.id}/friend-invites`, { friendUserId: 12 }, token);
    expect(first.status).toBe(201);
    const second = await call<{ id: number }>("POST", `/trips/${trip.id}/friend-invites`, { friendUserId: 12 }, token);
    expect(second.status).toBe(200);
    expect(second.json.id).toBe(first.json.id);
    const { json: sent } = await call<{ inviter: { nickname: string }; invitee: { nickname: string }; status: string }[]>("GET", `/trips/${trip.id}/friend-invites`, undefined, token);
    expect(sent).toEqual([expect.objectContaining({ inviter: expect.objectContaining({ nickname: "수정" }), invitee: expect.objectContaining({ nickname: "민지" }), status: "PENDING" })]);
    expect((await call("POST", `/trips/${trip.id}/friend-invites`, { friendUserId: 99 }, token)).json.code).toBe("FRIEND_NOT_FOUND");
  });

  it("참여자 내보내기(3-10)는 관리자만, 나 자신은 400, 내보낸 사람은 여행을 볼 수 없습니다", async () => {
    const a = await onboarded("수정");
    const b = await onboarded("민지");
    const trip = (await createTrip(a.token, { startDate: inDays(40), regionSigCd: "51150" })).json;
    const { json: link } = await call<{ token: string }>("POST", `/trips/${trip.id}/invites`, {}, a.token);
    await call("POST", `/invites/${link.token}/accept`, undefined, b.token);
    const bId = (await call<{ id: number }>("GET", "/users/me", undefined, b.token)).json.id;
    const aId = (await call<{ id: number }>("GET", "/users/me", undefined, a.token)).json.id;

    expect((await call("DELETE", `/trips/${trip.id}/participants/${aId}`, undefined, b.token)).json.code).toBe("TRIP_MANAGER_ONLY");
    expect((await call("DELETE", `/trips/${trip.id}/participants/${aId}`, undefined, a.token)).json.code).toBe("COMMON_INVALID_REQUEST");
    expect((await call("DELETE", `/trips/${trip.id}/participants/99999`, undefined, a.token)).json.code).toBe("TRIP_PARTICIPANT_NOT_FOUND");
    expect((await call("DELETE", `/trips/${trip.id}/participants/${bId}`, undefined, a.token)).status).toBe(204);
    expect((await call("GET", `/trips/${trip.id}/context`, undefined, b.token)).json.code).toBe("TRIP_NOT_FOUND");
    // 만든 사람이 나가면 가장 먼저 들어온 참여자가 관리자가 됩니다
    await call("POST", `/invites/${link.token}/accept`, undefined, b.token);
    await call("DELETE", `/trips/${trip.id}/participants/me`, undefined, a.token);
    const { json: rest } = await call<Participant[]>("GET", `/trips/${trip.id}/participants`, undefined, b.token);
    expect(rest).toEqual([expect.objectContaining({ nickname: "민지", isCreator: false, isManager: true })]);
  });

  it("접속 표시(3-11·3-12): 신호를 보낸 참여자만 60초 동안 보입니다", async () => {
    const a = await onboarded("수정");
    const b = await onboarded("민지");
    const trip = (await createTrip(a.token, { startDate: inDays(50), regionSigCd: "51150" })).json;
    const { json: link } = await call<{ token: string }>("POST", `/trips/${trip.id}/invites`, {}, a.token);
    await call("POST", `/invites/${link.token}/accept`, undefined, b.token);

    expect((await call("POST", `/trips/${trip.id}/presence`, undefined, a.token)).status).toBe(204);
    const { json } = await call<Presence>("GET", `/trips/${trip.id}/presence`, undefined, b.token);
    expect(json).toMatchObject({ heartbeatSeconds: 20, activeWindowSeconds: 60 });
    expect(json.participants.map((p) => p.nickname)).toEqual(["수정"]);
    await call("POST", `/trips/${trip.id}/presence`, undefined, b.token);
    expect((await call<Presence>("GET", `/trips/${trip.id}/presence`, undefined, a.token)).json.participants.map((p) => p.nickname)).toEqual(["수정", "민지"]);
  });
});

describe("친구 초대 링크 (2-4·2-7·2-8)", () => {
  it("로그인 없이 미리보고, 수락하면 끊었던 친구도 다시 친구가 됩니다", async () => {
    const token = await signup();
    const { json: link } = await call<{ token: string }>("POST", "/friend-links", { expiresInDays: 7 }, token);
    expect(link.token.startsWith("fl_")).toBe(true);

    const preview = await call<{ valid: boolean; inviterNickname: string }>("GET", `/friend-links/by-token/${link.token}`);
    expect(preview.status).toBe(200);
    expect(preview.json.valid).toBe(true);

    const friends = await call<{ userId: number; nickname: string }[]>("GET", "/friends", undefined, token);
    const owner = friends.json.find((f) => f.nickname === preview.json.inviterNickname)!;
    await call("DELETE", `/friends/${owner.userId}`, undefined, token);

    const accepted = await call<{ userId: number }>("POST", `/friend-links/by-token/${link.token}/accept`, undefined, token);
    expect(accepted.status).toBe(201);
    expect(accepted.json.userId).toBe(owner.userId);
    const again = await call("POST", `/friend-links/by-token/${link.token}/accept`, undefined, token);
    expect(again.status).toBe(200);
  });

  it("다른 용도의 토큰은 TOKEN_AUDIENCE_MISMATCH", async () => {
    const res = await call("GET", "/friend-links/by-token/iv_abc");
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("TOKEN_AUDIENCE_MISMATCH");
  });
});
