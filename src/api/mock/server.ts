// 개발용 목업 서버. EXPO_PUBLIC_API_MOCK=true 일 때 client.ts가 fetch 대신 이 함수를 부릅니다.
// 실제 백엔드(backend docs/api/*.md, docs/frontend-guide.md)와 같은 경로·응답 모양·오류 코드를 흉내 냅니다. 데이터는 개발용 가짜 값입니다.
import AsyncStorage from "@react-native-async-storage/async-storage";

import personas from "@/features/mbti/travel-personas.json";

import type {
  Diary,
  AuthResponse,
  DrawCondition,
  DrawResult,
  FriendInviteStatus,
  OnboardingQuestions,
  OnboardingSubmission,
  OnboardingSubmissionRequest,
  RegionCard,
  RegionMatch,
  RegionSelection,
  ScheduleDensity,
  TasteMode,
  Transport,
  TripContext,
  UserRef,
} from "../types";
import { addDays, fail, isYmd, MockError, nowIso, ok, type Raw, today, token } from "./common";
import { alternatives, applyOperations, firstLeg, generateCourse, type MockCourse, restaurantRecommendations, restaurantSearch, routes, toCourse } from "./course";
import { attractionsFor, BASE_REGIONS, distanceMeters, findAttraction, findRegion, isEligible, maxNightsFor, regionName, regionShortName } from "./data";
import { computeMbti, MOCK_MBTI_QUESTIONS } from "./mbti";

type MockUser = { id: number; email: string | null; password: string | null; nickname: string; kakaoId?: string };
type MockTrip = TripContext & {
  /** 참여 순서 */
  participants: number[];
  joinedAt: Record<string, string>;
  createdBy: number;
  /** 최초 코스 생성 시각 — 3-7로 코스를 비워도 남습니다 */
  firstGeneratedAt: string | null;
};
type MockFriendInvite = { id: number; tripId: number; invitee: UserRef; inviter: UserRef; status: FriendInviteStatus; createdAt: string };
type MockInviteLink = { id: number; tripId: number; token: string; createdBy: number; expiresAt: string; createdAt: string; revoked: boolean };
/** 친구 초대 링크(2-4)·코스 공유 링크(4-9)·여행기 공유 링크(6-9). ownerId는 회원·여행·여행기 ID */
type MockLink = { id: number; ownerId: number; token: string; createdBy: number; expiresAt: string; createdAt: string; revoked: boolean; acceptedCount: number };
type MockDb = {
  users: MockUser[];
  /** refresh 쿠키의 주인 (POST /auth/refresh) */
  sessionUserId: number | null;
  /** 로그인한 회원들 — 테스트에서 여러 회원이 함께 요청할 수 있게 */
  sessions: number[];
  submissions: Record<number, OnboardingSubmission>;
  preferences: Record<number, TasteMode>;
  trips: MockTrip[];
  courses: Record<number, MockCourse>;
  friendInvites: MockFriendInvite[];
  invites: MockInviteLink[];
  friendLinks: MockLink[];
  courseLinks: MockLink[];
  diaryLinks: MockLink[];
  removedFriends: Record<number, number[]>;
  /** 받은 초대 시연용 친구 여행을 이미 만들어 준 회원 */
  seededFor: number[];
  diaries: MockDiary[];
  seq: number;
};

/** 여행기 (6장). ownerId·지역 중심은 응답에 넣지 않습니다 */
type MockDiary = Diary & { ownerId: number; includeInTasteProfile: boolean; regionName: string | null; regionLat: number | null; regionLng: number | null };

// v3: 지역 먼저 흐름·코스·변경 기록·접속 표시 반영. 이전 목업 데이터와 모양이 달라 새 키를 씁니다.
const STORAGE_KEY = "tripin.mock.db.v3";
// 실제 네트워크처럼 약간 늦게 응답합니다 (테스트에서는 바로)
const IS_TEST = process.env.NODE_ENV === "test";
const LATENCY_MS = IS_TEST ? 0 : 350;
const MAX_PARTICIPANTS = 8;

// 목업 친구는 회원 데이터 없이 닉네임만 있습니다 (친구 API는 닉네임·친구가 된 날만 줍니다).
const FRIENDS = [
  { userId: 12, nickname: "민지", since: "2026-09-20T12:00:00" },
  { userId: 13, nickname: "서현", since: "2026-09-21T12:00:00" },
  { userId: 14, nickname: "지우", since: "2026-09-28T12:00:00" },
];

const seedDb = (): MockDb => ({
  users: [{ id: 1, email: "demo@tripin.app", password: "tripin1234", nickname: "수정" }],
  sessionUserId: null,
  sessions: [],
  submissions: {},
  preferences: {},
  trips: [],
  courses: {},
  friendInvites: [],
  invites: [],
  friendLinks: [],
  courseLinks: [],
  diaryLinks: [],
  removedFriends: {},
  seededFor: [],
  diaries: [],
  seq: 100,
});

let db: MockDb | null = null;
/** "보고 있어요" 신호 — 실제 서버처럼 메모리에만 둡니다: tripId → userId → 마지막 신호 */
const presence = new Map<number, Map<number, number>>();

async function load(): Promise<MockDb> {
  if (db) return db;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    db = saved ? { ...seedDb(), ...(JSON.parse(saved) as MockDb) } : seedDb();
  } catch {
    db = seedDb();
  }
  return db;
}

const save = () => {
  if (db) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db)).catch(() => undefined);
};

/** 목업 데이터를 처음 상태로 되돌립니다 (MY 화면 개발자 메뉴·테스트) */
export async function resetMockDb() {
  db = seedDb();
  presence.clear();
  await AsyncStorage.removeItem(STORAGE_KEY);
}

const notFoundTrip = () => new MockError(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없어요.");
const invalid = (message = "요청 값이 올바르지 않습니다.") => new MockError(400, "COMMON_INVALID_REQUEST", message);
const nicknameOf = (d: MockDb, id: number) => d.users.find((u) => u.id === id)?.nickname ?? FRIENDS.find((f) => f.userId === id)?.nickname ?? "여행자";
const userRef = (d: MockDb, id: number): UserRef => ({ userId: id, nickname: nicknameOf(d, id) });

// ── 온보딩 ──
const QUESTIONS: OnboardingQuestions = {
  questionVersion: "aihub-traveler-v2",
  travelStyles: [
    { number: 1, leftPole: "자연", rightPole: "도시", minValue: 1, maxValue: 7, neutralValue: 4, evidence: "OFFICIAL" },
    { number: 3, leftPole: "새로운 지역", rightPole: "익숙한 지역", minValue: 1, maxValue: 7, neutralValue: 4, evidence: "INFERRED" },
    { number: 5, leftPole: "휴양과 휴식", rightPole: "체험 활동", minValue: 1, maxValue: 7, neutralValue: 4, evidence: "INFERRED" },
    { number: 6, leftPole: "잘 알려지지 않은 곳", rightPole: "잘 알려진 명소", minValue: 1, maxValue: 7, neutralValue: 4, evidence: "INFERRED" },
  ],
  travelMotives: [
    { code: 1, label: "일상에서 벗어나기" },
    { code: 2, label: "휴식과 재충전" },
    { code: 3, label: "동반자와 추억 만들기" },
    { code: 4, label: "나를 돌아보기" },
    { code: 5, label: "SNS에 올릴 사진" },
    { code: 6, label: "운동과 건강" },
    { code: 7, label: "새로운 경험" },
    { code: 8, label: "역사와 문화 탐방" },
    { code: 9, label: "특별한 날 기념" },
  ],
  maxTravelMotives: 3,
  maxLikedRegions: 3,
  excludeTags: ["계단·경사 많은 곳", "물놀이", "야간 이동", "오래 걷기"],
  scheduleDensityOptions: ["RELAXED", "PACKED"],
  // 실제 서버처럼 선택지 → 글자 매핑은 내려주지 않습니다
  mbtiQuestions: MOCK_MBTI_QUESTIONS.map((q) => ({
    number: q.number,
    question: q.text,
    choices: [
      { choice: 1 as const, label: q.choices[0].text },
      { choice: 2 as const, label: q.choices[1].text },
    ],
  })),
};
const SUPPORTED_VERSIONS = ["aihub-traveler-v2", "aihub-traveler-v1"];
const DENSITIES: ScheduleDensity[] = ["RELAXED", "PACKED"];
const TRANSPORTS: Transport[] = ["WALK", "CAR", "PUBLIC_TRANSIT"];

const profileText = (req: OnboardingSubmissionRequest) => {
  const parts = QUESTIONS.travelStyles
    .map((q) => {
      const v = req.travelStyles[String(q.number)];
      if (!v || v === 4) return null;
      const pole = v < 4 ? q.leftPole : q.rightPole;
      const strength = Math.abs(v - 4) === 3 ? "매우" : Math.abs(v - 4) === 2 ? "꽤" : "조금";
      return `${pole}을 ${strength} 선호`;
    })
    .filter(Boolean);
  return parts.length ? `${parts.join(", ")}하는 여행자.` : "취향이 고르게 열려 있는 여행자.";
};
/** 요청한 밀도 → 최신 설문 밀도 → RELAXED */
const densityFor = (d: MockDb, me: MockUser, requested: unknown): ScheduleDensity => {
  if (requested !== undefined && requested !== null) {
    if (!DENSITIES.includes(requested as ScheduleDensity)) throw invalid("일정 밀도 값이 올바르지 않습니다.");
    return requested as ScheduleDensity;
  }
  return d.submissions[me.id]?.scheduleDensity ?? "RELAXED";
};

// ── 라우터 ──
type Ctx = { db: MockDb; me: MockUser | null; body: any; query: { get: (key: string) => string | null } };
type Handler = (ctx: Ctx, params: string[]) => Raw;
const routes_: [string, RegExp, Handler, { auth?: boolean }?][] = [];
const on = (method: string, pattern: string, handler: Handler, opts?: { auth?: boolean }) =>
  routes_.push([method, new RegExp(`^${pattern.replace(/:\w+/g, "([^/]+)")}$`), handler, opts]);

const loginMethods = (u: MockUser) => [...(u.password ? ["EMAIL"] : []), ...(u.kakaoId ? ["KAKAO"] : [])];

const startSession = (d: MockDb, u: MockUser): AuthResponse => {
  d.sessionUserId = u.id;
  if (!d.sessions.includes(u.id)) d.sessions.push(u.id);
  return {
    user: { id: u.id, email: u.email, nickname: u.nickname, profileImage: null },
    accessToken: `mock.${u.id}.${Date.now()}`,
    tokenType: "Bearer",
    expiresInSeconds: 1800,
    onboardingCompleted: !!d.submissions[u.id],
  };
};

on("POST", "/auth/signup", ({ db: d, body }) => {
  const email = String(body?.email ?? "").trim().toLowerCase();
  const fieldErrors = [];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.push({ field: "email", message: "이메일 형식이 올바르지 않습니다." });
  if (String(body?.password ?? "").length < 8) fieldErrors.push({ field: "password", message: "8자 이상 입력해 주세요." });
  if (!String(body?.nickname ?? "").trim()) fieldErrors.push({ field: "nickname", message: "필수 값입니다." });
  if (fieldErrors.length) return fail(400, "COMMON_INVALID_REQUEST", "요청 값이 올바르지 않습니다.", { fieldErrors });
  if (d.users.some((u) => u.email === email)) return fail(409, "AUTH_DUPLICATE_EMAIL", "이미 가입된 이메일입니다.");
  const user = { id: ++d.seq, email, password: body.password, nickname: String(body.nickname).trim() };
  d.users.push(user);
  return ok(startSession(d, user), 201);
}, { auth: false });

on("POST", "/auth/login", ({ db: d, body }) => {
  const user = d.users.find((u) => u.email === String(body?.email ?? "").trim().toLowerCase() && u.password === body?.password);
  if (!user) return fail(401, "AUTH_INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
  return ok(startSession(d, user));
}, { auth: false });

// 카카오 로그인: 목업은 카카오 서버 없이 code를 회원번호처럼 써서 소셜 전용 회원을 만듭니다.
on("POST", "/auth/kakao", ({ db: d, body }) => {
  if (!body?.code || !body?.redirectUri) return fail(400, "COMMON_INVALID_REQUEST", "요청 값이 올바르지 않습니다.");
  if (body.code === "invalid") return fail(401, "AUTH_KAKAO_INVALID_CODE", "카카오 로그인을 다시 시도해 주세요.");
  const kakaoId = String(body.code).slice(0, 32);
  let user = d.users.find((u) => u.kakaoId === kakaoId);
  const created = !user;
  if (!user) {
    user = { id: ++d.seq, email: null, password: null, nickname: `여행자${String(1000 + (d.seq % 9000))}`, kakaoId };
    d.users.push(user);
  }
  return ok(startSession(d, user), created ? 201 : 200);
}, { auth: false });

on("POST", "/auth/refresh", ({ db: d }) => {
  const user = d.users.find((u) => u.id === d.sessionUserId);
  if (!user) return fail(401, "AUTH_INVALID_REFRESH_TOKEN", "다시 로그인해 주세요.");
  return ok(startSession(d, user));
}, { auth: false });

on("POST", "/auth/logout", ({ db: d }) => {
  d.sessions = d.sessions.filter((id) => id !== d.sessionUserId);
  d.sessionUserId = null;
  return ok(null, 204);
}, { auth: false });

on("GET", "/users/me", ({ db: d, me }) =>
  ok({ id: me!.id, email: me!.email, nickname: me!.nickname, profileImage: null, onboardingCompleted: !!d.submissions[me!.id], loginMethods: loginMethods(me!) }),
);

on("GET", "/onboarding/questions", () => ok(QUESTIONS), { auth: false });

on("POST", "/onboarding/submissions", ({ db: d, me, body }) => {
  const req = body as OnboardingSubmissionRequest;
  if (!SUPPORTED_VERSIONS.includes(req.questionVersion)) return fail(400, "ONBOARDING_INVALID_QUESTION_VERSION", "설문이 바뀌었어요. 다시 불러와 주세요.");
  let mbtiCode: string | null = null;
  if (req.questionVersion === "aihub-traveler-v2") {
    const answers = req.mbtiAnswers ?? {};
    const numbers = MOCK_MBTI_QUESTIONS.map((q) => String(q.number));
    if (Object.keys(answers).some((k) => !numbers.includes(k) || ![1, 2].includes(answers[k])))
      return fail(400, "ONBOARDING_INVALID_CHOICE", "여행 MBTI 답이 올바르지 않습니다.");
    if (numbers.some((n) => !answers[n])) return fail(400, "ONBOARDING_MISSING_QUESTION_ANSWER", "답하지 않은 여행 MBTI 문항이 있어요.");
    mbtiCode = computeMbti(numbers.map((n) => (answers[n] === 1 ? 0 : 1)));
  }
  const keys = ["1", "3", "5", "6"];
  if (!keys.every((k) => Number.isInteger(req.travelStyles?.[k]) && req.travelStyles[k] >= 1 && req.travelStyles[k] <= 7))
    return fail(400, "ONBOARDING_INVALID_TRAVEL_STYLES", "여행 스타일 답이 올바르지 않습니다.");
  if ((req.travelMotives ?? []).length > 3) return fail(400, "ONBOARDING_INVALID_TRAVEL_MOTIVE", "여행 동기는 최대 3개입니다.");
  if ((req.likedRegions ?? []).length > 3) return fail(400, "ONBOARDING_TOO_MANY_LIKED_REGIONS", "좋아하는 지역은 최대 3곳입니다.");
  if (req.scheduleDensity !== undefined && !DENSITIES.includes(req.scheduleDensity))
    return fail(400, "ONBOARDING_INVALID_SCHEDULE_DENSITY", "일정 밀도 값이 올바르지 않습니다.");
  // 보낸 밀도가 우선, 없으면 MBTI J → PACKED, P → RELAXED, MBTI 없는 v1은 RELAXED (D3-2)
  const scheduleDensity: ScheduleDensity = req.scheduleDensity ?? (mbtiCode?.[3] === "J" ? "PACKED" : "RELAXED");
  // 실제 응답처럼 excludeTags·mbtiAnswers는 돌려주지 않습니다 (백엔드 OnboardingSubmissionResponse)
  const submission: OnboardingSubmission = {
    questionVersion: req.questionVersion,
    travelStyles: req.travelStyles,
    scheduleDensity,
    travelMotives: req.travelMotives ?? [],
    likedRegions: req.likedRegions ?? [],
    mbtiCode,
    submissionId: token("sub_"),
    profileText: profileText(req),
    tasteStatus: "READY",
    onboardingCompleted: true,
    createdAt: nowIso(),
  };
  d.submissions[me!.id] = submission;
  return ok(submission, 201);
});

on("GET", "/onboarding/me", ({ db: d, me }) => {
  const submission = d.submissions[me!.id] ?? null;
  return ok({ onboardingCompleted: !!submission, submission });
});

on("GET", "/me/preferences", ({ db: d, me }) => ok({ courseTasteMode: d.preferences[me!.id] ?? "TASTE" }));
on("PATCH", "/me/preferences", ({ db: d, me, body }) => {
  const mode = body?.courseTasteMode;
  if (mode !== "TASTE" && mode !== "RANDOM")
    return fail(400, "COMMON_INVALID_REQUEST", "요청 값이 올바르지 않습니다.", { fieldErrors: [{ field: "courseTasteMode", message: "TASTE 또는 RANDOM이어야 합니다." }] });
  d.preferences[me!.id] = mode;
  return ok({ courseTasteMode: mode });
});

// ── 지역 ──
on("GET", "/regions", ({ query }) => {
  const days = query.get("days") ? Number(query.get("days")) : null;
  const density = (query.get("scheduleDensity") as ScheduleDensity | null) ?? "RELAXED";
  if (days !== null && (days < 1 || days > 7)) return fail(400, "REGION_INVALID_DAYS", "여행 일수는 1~7일입니다.");
  const regions = BASE_REGIONS.map((r) => {
    if (days === null) return { ...r, drawEligible: null, ineligibleReasons: null };
    const eligible = isEligible(r.sigCd, days, density);
    return { ...r, drawEligible: eligible, ineligibleReasons: eligible ? [] : ["INSUFFICIENT_ATTRACTIONS"] };
  });
  return ok({
    days,
    scheduleDensity: days === null ? null : density,
    eligibleCount: days === null ? null : regions.filter((r) => r.drawEligible).length,
    regions,
  });
});

// 시연 지역의 한 줄 소개·태그(목업 문구). 그 밖의 지역은 승인 전처럼 비워 둡니다.
const SHOWCASE_COPY: Record<string, { tagline: string; tags: string[] }> = {
  "51150": { tagline: "바다와 카페 사이, 천천히 머무는 곳", tags: ["바다", "카페", "산책"] },
  "47130": { tagline: "오래된 길을 따라 걷는 시간 여행", tags: ["역사", "산책", "야경"] },
  "26350": { tagline: "도시와 바다를 함께 즐기는 곳", tags: ["바다", "도시", "야경"] },
  "50110": { tagline: "숲과 바다가 번갈아 펼쳐지는 곳", tags: ["자연", "바다", "숲"] },
  "46130": { tagline: "바닷가 산책과 밤 풍경이 좋은 곳", tags: ["바다", "야경", "산책"] },
  "52111": { tagline: "골목과 한옥 사이를 걷는 곳", tags: ["전통", "골목", "먹거리"] },
};

on("GET", "/regions/:sigCd/card", (_ctx, [sigCd]) => {
  const base = findRegion(sigCd);
  if (!base) return fail(404, "REGION_NOT_FOUND", "없는 지역입니다.");
  const copy = SHOWCASE_COPY[sigCd];
  // 대표 관광지 규칙처럼 지역의 관광지 3곳을 "만나볼 순간"으로 (추첨 가능한 지역만)
  const landmarks = isEligible(sigCd, 1, "RELAXED")
    ? attractionsFor(sigCd)
        .slice(0, 3)
        .map((a) => ({ attractionId: a.attractionId, name: a.name, thumbnailUrl: null, oneLine: a.oneLine }))
    : [];
  const card: RegionCard = {
    sigCd,
    province: base.province,
    city: base.city,
    title: base.city,
    tagline: copy?.tagline ?? null,
    tags: copy?.tags ?? [],
    introduction: [],
    heroImage: null,
    characteristics: [],
    historyHighlights: [],
    landmarks,
    sources: [],
    updatedAt: null,
  };
  return ok(card);
});

type Persona = { code: string; name: string; pace: string; places: string[] };
on("GET", "/regions/:sigCd/match", ({ db: d, me }, [sigCd]) => {
  const region = findRegion(sigCd);
  if (!region) return fail(404, "REGION_NOT_FOUND", "없는 지역입니다.");
  const mbtiCode = d.submissions[me!.id]?.mbtiCode ?? null;
  const persona = (personas.types as Persona[]).find((p) => p.code === mbtiCode);
  if (!mbtiCode || !persona) {
    const empty: RegionMatch = { sigCd, mbtiCode: null, personaName: null, text: null, textSource: null, aiGenerated: false };
    return ok(empty);
  }
  // 목업은 규칙 문장(RULE)만 — 성향의 선호 장소·속도로 만든 일반 문장입니다
  const match: RegionMatch = {
    sigCd,
    mbtiCode,
    personaName: persona.name,
    text: `${regionShortName(region)}에서 ${persona.places.slice(0, 2).join("·")} 같은 곳을 ${persona.pace} 둘러보기 좋아요.`,
    textSource: "RULE",
    aiGenerated: false,
  };
  return ok(match);
});

const checkOrigin = (lat: unknown, lng: unknown) => {
  const hasLat = lat !== undefined && lat !== null;
  const hasLng = lng !== undefined && lng !== null;
  if (hasLat !== hasLng) throw new MockError(400, "TRIP_INVALID_ORIGIN", "출발지 위도·경도를 함께 보내 주세요.");
  if (!hasLat) return null;
  if (typeof lat !== "number" || typeof lng !== "number" || lat < 33 || lat > 39 || lng < 124 || lng > 132)
    throw new MockError(400, "TRIP_INVALID_ORIGIN", "출발지가 범위를 벗어났어요.");
  return { lat, lng };
};

/** 3-7·7-5 공통: 조건을 반영한 후보와 반영·무시한 조건 */
function drawCandidates(d: MockDb, me: MockUser, mode: unknown, conditions: unknown, origin: { lat: number; lng: number } | null, days: number, density: ScheduleDensity) {
  if (mode !== "RANDOM" && mode !== "CONDITIONAL") throw new MockError(400, "DRAW_INVALID_MODE", "뽑기 방식이 올바르지 않아요.");
  let candidates = BASE_REGIONS.filter((r) => isEligible(r.sigCd, days, density));
  const applied: DrawCondition[] = [];
  const ignored: { condition: DrawCondition; reason: string }[] = [];
  if (mode === "CONDITIONAL") {
    if (!Array.isArray(conditions) || conditions.length === 0) throw new MockError(400, "DRAW_NO_CONDITION_SELECTED", "조건을 하나 이상 골라 주세요.");
    if (conditions.some((c) => c !== "DISTANCE" && c !== "MY_TASTE")) throw new MockError(400, "DRAW_INVALID_MODE", "조건 값이 올바르지 않아요.");
    if (conditions.includes("DISTANCE")) {
      if (origin) {
        applied.push("DISTANCE");
        // 출발지에서 가까운 쪽 40%만 남깁니다 (실제 서버는 거리 가중치)
        const sorted = [...candidates].sort((a, b) => distanceMeters(origin, { lat: a.centerLat, lng: a.centerLng }) - distanceMeters(origin, { lat: b.centerLat, lng: b.centerLng }));
        candidates = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.4)));
      } else ignored.push({ condition: "DISTANCE", reason: "ORIGIN_MISSING" });
    }
    if (conditions.includes("MY_TASTE")) {
      if (d.submissions[me.id]?.tasteStatus === "READY") applied.push("MY_TASTE");
      else ignored.push({ condition: "MY_TASTE", reason: "TASTE_NOT_READY" });
    }
  }
  if (!candidates.length) throw new MockError(422, "DRAW_NO_ELIGIBLE_REGION", "뽑을 수 있는 지역이 없어요.");
  return { candidates, applied, ignored };
}

on("POST", "/regions/draw", ({ db: d, me, body }) => {
  const origin = checkOrigin(body?.originLat, body?.originLng);
  const density = densityFor(d, me!, body?.scheduleDensity);
  // 날짜를 아직 모르므로 1일 기준으로 뽑고, 이 지역의 최대 박수를 함께 줍니다 (D1)
  const { candidates, applied, ignored } = drawCandidates(d, me!, body?.mode, body?.conditions, origin, 1, density);
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const result: DrawResult = {
    sigCd: picked.sigCd,
    province: picked.province,
    city: picked.city,
    lat: picked.centerLat,
    lng: picked.centerLng,
    regionSelection: body.mode,
    scheduleDensity: density,
    maxNights: Math.max(0, maxNightsFor(picked.sigCd, density)),
    appliedConditions: applied,
    ignoredConditions: ignored,
    candidateCount: candidates.length,
    warnings: [],
  };
  return ok(result);
});

// ── 여행 ──
const myTrips = (d: MockDb, me: MockUser) => d.trips.filter((t) => t.participants.includes(me.id));
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart <= bEnd && bStart <= aEnd;
const fallbackTitle = (t: { startDate: string; nights: number }) => {
  const [, m, dd] = t.startDate.split("-").map(Number);
  return t.nights === 0 ? `${m}월 ${dd}일 당일 여행` : `${m}월 ${dd}일부터 ${t.nights}박 ${t.nights + 1}일 여행`;
};
const tripTitle = (d: MockDb, t: MockTrip) => d.courses[t.id]?.title ?? fallbackTitle(t);
const publicTrip = ({ participants: _p, joinedAt: _j, createdBy: _c, firstGeneratedAt: _f, ...ctx }: MockTrip): TripContext => ctx;
const findTrip = (d: MockDb, me: MockUser, id: string) => {
  const trip = myTrips(d, me).find((t) => t.id === Number(id));
  if (!trip) throw notFoundTrip();
  return trip;
};
const conflictsOf = (d: MockDb, me: MockUser, startDate: string, endDate: string, exceptTripId?: number) =>
  myTrips(d, me)
    .filter((t) => t.id !== exceptTripId && overlaps(t.startDate, t.endDate, startDate, endDate))
    .map((t) => ({ tripId: t.id, title: tripTitle(d, t), startDate: t.startDate, endDate: t.endDate }));
/** 종료일이 지난 여행(오늘 Asia/Seoul 기준) */
const isEnded = (t: MockTrip) => t.endDate < today();
/** 종료된 일반 여행은 읽기 전용. 사후 기록 여행은 (목업엔 여행기가 없으니) 계속 편집됩니다 */
const assertEditable = (t: MockTrip) => {
  if (isEnded(t) && !t.retroactive) throw new MockError(409, "TRIP_ENDED", "끝난 여행은 바꿀 수 없어요.");
};
const assertVersion = (t: MockTrip, version: unknown) => {
  if (version !== t.version) throw new MockError(409, "TRIP_VERSION_CONFLICT", "다른 참여자가 먼저 수정했어요.");
};
/** 관리자: 만든 사람, 나갔으면 가장 먼저 들어온 참여자 */
const managerOf = (t: MockTrip) => (t.participants.includes(t.createdBy) ? t.createdBy : t.participants[0]);
const joinTrip = (t: MockTrip, userId: number) => {
  if (!t.participants.includes(userId)) t.participants.push(userId);
  t.joinedAt[String(userId)] = nowIso();
};
const deleteTripIfEmpty = (d: MockDb, t: MockTrip) => {
  if (t.participants.length > 0) return;
  d.trips = d.trips.filter((x) => x.id !== t.id);
  delete d.courses[t.id];
  d.invites = d.invites.filter((i) => i.tripId !== t.id);
  d.friendInvites = d.friendInvites.filter((i) => i.tripId !== t.id);
  presence.delete(t.id);
};
const checkDates = (startDate: unknown, nights: unknown) => {
  if (!isYmd(startDate)) throw new MockError(400, "TRIP_INVALID_START_DATE", "시작일이 올바르지 않아요.");
  if (!Number.isInteger(nights) || (nights as number) < 0 || (nights as number) > 6) throw new MockError(400, "TRIP_INVALID_NIGHTS", "여행 기간은 당일~6박 7일입니다.");
  return { startDate, nights: nights as number, endDate: addDays(startDate, nights as number) };
};

on("GET", "/trips/unavailable-dates", ({ db: d, me, query }) => {
  const from = query.get("from") ?? "0000-01-01";
  const to = query.get("to") ?? "9999-12-31";
  return ok(myTrips(d, me!).filter((t) => overlaps(t.startDate, t.endDate, from, to)).map((t) => ({ tripId: t.id, startDate: t.startDate, endDate: t.endDate })));
});

on("POST", "/trips/context/check", ({ db: d, me, body }) => {
  const { nights, startDate, endDate } = checkDates(body?.startDate, body?.nights);
  const density = densityFor(d, me!, body?.scheduleDensity);
  let regionEligible: boolean | null = null;
  if (body?.sigCd !== undefined && body?.sigCd !== null) {
    if (!findRegion(body.sigCd)) return fail(404, "REGION_NOT_FOUND", "없는 지역입니다.");
    regionEligible = isEligible(body.sigCd, nights + 1, density);
  }
  const conflicts = conflictsOf(d, me!, startDate, endDate);
  const eligibleRegionCount = BASE_REGIONS.filter((r) => isEligible(r.sigCd, nights + 1, "RELAXED")).length;
  return ok({ available: conflicts.length === 0, endDate, conflicts, eligibleRegionCount, regionEligible });
});

on("POST", "/trips", ({ db: d, me, body }) => {
  if (!d.submissions[me!.id]) return fail(409, "ONBOARDING_REQUIRED", "취향 설문을 먼저 마쳐 주세요.");
  const { startDate, nights, endDate } = checkDates(body?.startDate, body?.nights);
  const transport: Transport = body?.transport ?? "CAR";
  if (!TRANSPORTS.includes(transport)) return fail(400, "TRIP_INVALID_TRANSPORT", "이동수단 값이 올바르지 않아요.");
  const origin = checkOrigin(body?.originLat, body?.originLng);
  const regionSigCd: string | null = body?.regionSigCd ?? null;
  const regionSelection: RegionSelection = body?.regionSelection ?? "MANUAL";
  if (!["RANDOM", "CONDITIONAL", "MANUAL"].includes(regionSelection)) return fail(400, "DRAW_INVALID_MODE", "지역 선택 방식이 올바르지 않아요.");
  const density = densityFor(d, me!, body?.scheduleDensity);
  if (regionSigCd !== null && !findRegion(regionSigCd)) return fail(404, "REGION_NOT_FOUND", "없는 지역입니다.");
  const conflicts = conflictsOf(d, me!, startDate, endDate);
  if (conflicts.length) return fail(409, "TRIP_DATE_OVERLAP", "이미 있는 여행과 날짜가 겹칩니다.", { details: { conflicts } });
  if (regionSigCd !== null && !isEligible(regionSigCd, nights + 1, density))
    return fail(422, "DRAW_REGION_NOT_ELIGIBLE", "이 기간에 코스를 만들 관광지가 부족한 지역이에요.");
  const trip: MockTrip = {
    id: ++d.seq,
    startDate,
    endDate,
    nights,
    transport,
    originLat: origin?.lat ?? null,
    originLng: origin?.lng ?? null,
    regionSigCd,
    regionSelection: regionSigCd ? regionSelection : null,
    scheduleDensity: regionSigCd ? density : null,
    hasCourse: false,
    retroactive: endDate < today(),
    version: 0,
    participants: [],
    joinedAt: {},
    createdBy: me!.id,
    firstGeneratedAt: null,
  };
  joinTrip(trip, me!.id);
  d.trips.push(trip);
  return ok(publicTrip(trip), 201);
});

on("GET", "/trips", ({ db: d, me, query }) => {
  const period = query.get("period");
  const now = today();
  return ok(
    myTrips(d, me!)
      .filter((t) => (period === "UPCOMING" ? t.endDate >= now : period === "PAST" ? t.endDate < now : true))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((t) => ({
        tripId: t.id,
        title: tripTitle(d, t),
        regionSigCd: t.regionSigCd,
        regionName: regionName(t.regionSigCd),
        startDate: t.startDate,
        endDate: t.endDate,
        nights: t.nights,
        participants: t.participants.map((id) => userRef(d, id)),
        hasCourse: t.hasCourse,
        retroactive: t.retroactive,
        myDiaryId: d.diaries.find((x) => x.tripId === t.id && x.ownerId === me!.id)?.diaryId ?? null,
        updatedAt: d.courses[t.id]?.updatedAt ?? nowIso(),
      })),
  );
});

on("GET", "/trips/:id/context", ({ db: d, me }, [id]) => ok(publicTrip(findTrip(d, me!, id))));

on("PATCH", "/trips/:id/context", ({ db: d, me, body }, [id]) => {
  const trip = findTrip(d, me!, id);
  if (body?.startDate !== undefined || body?.nights !== undefined) return fail(400, "COMMON_INVALID_REQUEST", "날짜는 바꿀 수 없어요.");
  assertEditable(trip);
  if (body?.transport !== undefined && !TRANSPORTS.includes(body.transport)) return fail(400, "TRIP_INVALID_TRANSPORT", "이동수단 값이 올바르지 않아요.");
  const hasOrigin = body && ("originLat" in body || "originLng" in body);
  const origin = hasOrigin ? checkOrigin(body.originLat, body.originLng) : undefined;
  assertVersion(trip, body?.version);
  if (body?.transport) trip.transport = body.transport;
  if (origin !== undefined) {
    trip.originLat = origin?.lat ?? null;
    trip.originLng = origin?.lng ?? null;
  }
  trip.version += 1;
  return ok(publicTrip(trip));
});

on("POST", "/trips/:id/region", ({ db: d, me, body }, [id]) => {
  const trip = findTrip(d, me!, id);
  assertEditable(trip);
  if (trip.hasCourse && body?.replaceCourse !== true)
    return fail(409, "TRIP_CONTEXT_LOCKED", "코스가 있는 여행이에요. 코스를 비우고 다시 만들려면 확인 후 다시 보내 주세요.");
  assertVersion(trip, body?.version);
  const density = densityFor(d, me!, body?.scheduleDensity ?? trip.scheduleDensity);
  const days = trip.nights + 1;
  let picked: (typeof BASE_REGIONS)[number];
  let applied: DrawCondition[] = [];
  let ignored: { condition: DrawCondition; reason: string }[] = [];
  let candidateCount: number;
  if (body?.mode === "MANUAL") {
    const region = findRegion(body.sigCd);
    if (!region) return fail(404, "REGION_NOT_FOUND", "없는 지역입니다.");
    if (!isEligible(region.sigCd, days, density)) return fail(422, "DRAW_REGION_NOT_ELIGIBLE", "이 기간에 코스를 만들 관광지가 부족한 지역이에요.");
    picked = region;
    candidateCount = BASE_REGIONS.filter((r) => isEligible(r.sigCd, days, density)).length;
  } else {
    const origin = trip.originLat !== null && trip.originLng !== null ? { lat: trip.originLat, lng: trip.originLng } : null;
    const drawn = drawCandidates(d, me!, body?.mode, body?.conditions, origin, days, density);
    picked = drawn.candidates[Math.floor(Math.random() * drawn.candidates.length)];
    applied = drawn.applied;
    ignored = drawn.ignored;
    candidateCount = drawn.candidates.length;
  }
  if (trip.hasCourse) {
    // replaceCourse: 코스를 비웁니다 (최초 생성 표시는 남아 다음 5-1은 재생성)
    delete d.courses[trip.id];
    trip.hasCourse = false;
  }
  trip.regionSigCd = picked.sigCd;
  trip.regionSelection = body.mode;
  trip.scheduleDensity = density;
  trip.version += 1;
  return ok({
    tripId: trip.id,
    regionSigCd: picked.sigCd,
    province: picked.province,
    city: picked.city,
    regionSelection: body.mode,
    scheduleDensity: density,
    appliedConditions: applied,
    ignoredConditions: ignored,
    candidateCount,
    warnings: [],
    version: trip.version,
  });
});

on("GET", "/trips/:id/participants", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  const manager = managerOf(trip);
  return ok(
    trip.participants.map((uid) => ({
      userId: uid,
      nickname: nicknameOf(d, uid),
      isCreator: uid === trip.createdBy,
      isManager: uid === manager,
      joinedAt: trip.joinedAt[String(uid)] ?? nowIso(),
    })),
  );
});

on("DELETE", "/trips/:id/participants/me", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  trip.participants = trip.participants.filter((uid) => uid !== me!.id);
  presence.get(trip.id)?.delete(me!.id);
  // 마지막 참여자가 나가면 여행·코스·초대가 모두 지워집니다.
  deleteTripIfEmpty(d, trip);
  return ok(null, 204);
});

on("DELETE", "/trips/:id/participants/:userId", ({ db: d, me }, [id, userIdParam]) => {
  const trip = findTrip(d, me!, id);
  const userId = Number(userIdParam);
  if (userId === me!.id) return fail(400, "COMMON_INVALID_REQUEST", "나 자신은 '여행 나가기'로 나가요.");
  assertEditable(trip);
  if (managerOf(trip) !== me!.id) return fail(403, "TRIP_MANAGER_ONLY", "참여자 내보내기는 관리자만 할 수 있어요.");
  if (!trip.participants.includes(userId)) return fail(404, "TRIP_PARTICIPANT_NOT_FOUND", "이 여행의 참여자가 아니에요.");
  trip.participants = trip.participants.filter((uid) => uid !== userId);
  presence.get(trip.id)?.delete(userId);
  return ok(null, 204);
});

// ── 접속 표시 (3-11·3-12) ──
const HEARTBEAT_SECONDS = 20;
const ACTIVE_WINDOW_SECONDS = 60;
on("POST", "/trips/:id/presence", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  if (!presence.has(trip.id)) presence.set(trip.id, new Map());
  presence.get(trip.id)!.set(me!.id, Date.now());
  return ok(null, 204);
});
on("GET", "/trips/:id/presence", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  const seen = presence.get(trip.id) ?? new Map<number, number>();
  const cutoff = Date.now() - ACTIVE_WINDOW_SECONDS * 1000;
  const participants = trip.participants
    .map((uid) => {
      // 목업 친구(회원 데이터 없음)는 늘 보고 있는 것처럼 보여 "민지가 보고 있어요"를 확인할 수 있게 합니다
      const at = FRIENDS.some((f) => f.userId === uid) ? Date.now() : seen.get(uid);
      return at !== undefined && at >= cutoff ? { userId: uid, nickname: nicknameOf(d, uid), lastSeenAt: new Date(at).toISOString().slice(0, 19) } : null;
    })
    .filter((p) => p !== null);
  return ok({ heartbeatSeconds: HEARTBEAT_SECONDS, activeWindowSeconds: ACTIVE_WINDOW_SECONDS, participants });
});

// ── 초대 링크 (4-1~4-5, 4-16) ──
on("POST", "/trips/:id/invites", ({ db: d, me, body }, [id]) => {
  const trip = findTrip(d, me!, id);
  if (isEnded(trip)) return fail(409, "TRIP_ENDED", "끝난 여행에는 초대할 수 없어요.");
  const days = Number(body?.expiresInDays ?? 7);
  if (!Number.isInteger(days) || days < 1 || days > 30) return fail(400, "INVALID_EXPIRES_IN_DAYS", "만료 기간은 1~30일입니다.");
  const expires = new Date(Date.now() + days * 86400000).toISOString().slice(0, 19);
  const link = { id: ++d.seq, tripId: trip.id, token: token("iv_"), createdBy: me!.id, expiresAt: expires, createdAt: nowIso(), revoked: false };
  d.invites.push(link);
  return ok({ id: link.id, token: link.token, expiresAt: link.expiresAt, createdAt: link.createdAt }, 201);
});

on("GET", "/trips/:id/invites", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  return ok(
    d.invites
      .filter((i) => i.tripId === trip.id)
      .sort((a, b) => b.id - a.id)
      .map((i) => ({ id: i.id, expiresAt: i.expiresAt, revoked: i.revoked, createdBy: userRef(d, i.createdBy), createdAt: i.createdAt })),
  );
});

on("DELETE", "/trips/:id/invites/:inviteId", ({ db: d, me }, [id, inviteId]) => {
  const trip = findTrip(d, me!, id);
  const link = d.invites.find((i) => i.id === Number(inviteId) && i.tripId === trip.id);
  if (!link) return fail(404, "INVITE_NOT_FOUND", "없는 초대예요.");
  link.revoked = true;
  return ok(null, 204);
});

/** 초대 token → 링크·여행. 용도가 다른 token·없는 token·만료·폐기를 가립니다 */
function inviteByToken(d: MockDb, value: string) {
  if (!value.startsWith("iv_")) throw new MockError(400, "TOKEN_AUDIENCE_MISMATCH", "초대 링크가 아니에요.");
  const link = d.invites.find((i) => i.token === value);
  const trip = link && d.trips.find((t) => t.id === link.tripId);
  if (!link || !trip) throw new MockError(404, "INVITE_NOT_FOUND", "없는 초대예요.");
  if (link.revoked) throw new MockError(410, "INVITE_REVOKED", "더 이상 쓸 수 없는 초대 링크예요.");
  if (link.expiresAt < nowIso()) throw new MockError(410, "INVITE_EXPIRED", "만료된 초대 링크예요.");
  return { link, trip };
}

on("GET", "/invites/:token", ({ db: d }, [value]) => {
  const { link, trip } = inviteByToken(d, value);
  return ok({
    valid: true,
    title: tripTitle(d, trip),
    startDate: trip.startDate,
    endDate: trip.endDate,
    regionSigCd: trip.regionSigCd,
    regionName: regionName(trip.regionSigCd),
    heroImageUrl: null,
    inviterNickname: nicknameOf(d, link.createdBy),
    participantCount: trip.participants.length,
    participants: trip.participants.map((uid) => ({ nickname: nicknameOf(d, uid) })),
    hasCourse: trip.hasCourse,
  });
}, { auth: false });

on("GET", "/invites/:token/course", ({ db: d }, [value]) => {
  const { trip } = inviteByToken(d, value);
  return ok(toCourse(trip, d.courses[trip.id] ?? null, { role: "VIEWER" }));
}, { auth: false });

// ── 지도 관광지 핀·상세 (7-3·7-4) ──
// 목업 관광지는 모두 추천 가능으로 보되, 이름 끝 번호가 붙은 장소(같은 이름이 한 바퀴 돈 것)는 추천 불가로 둡니다.
const recommendableMock = (name: string) => !/\s\d+$/.test(name);

on("GET", "/regions/:sigCd/attractions", ({ query }, [sigCd]) => {
  if (!findRegion(sigCd)) return fail(404, "REGION_NOT_FOUND", "없는 지역이에요.");
  const bbox = query.get("bbox");
  let box: number[] | null = null;
  if (bbox) {
    box = bbox.split(",").map(Number);
    const [minLng, minLat, maxLng, maxLat] = box;
    const ok = box.length === 4 && box.every(Number.isFinite) && minLng < maxLng && minLat < maxLat && minLat >= 33 && maxLat <= 39 && minLng >= 124 && maxLng <= 132;
    if (!ok) return fail(400, "ATTRACTION_INVALID_BOUNDS", "지도 범위가 올바르지 않아요.");
  }
  const category = query.get("category");
  const items = attractionsFor(sigCd)
    .filter((a) => !box || (a.lng >= box[0] && a.lat >= box[1] && a.lng <= box[2] && a.lat <= box[3]))
    .filter((a) => !category || a.category === category)
    .map((a) => ({ attractionId: a.attractionId, name: a.name, thumbnailUrl: null, category: a.category, lat: a.lat, lng: a.lng, recommendable: recommendableMock(a.name) }));
  return ok({ items, nextCursor: null });
});

on("GET", "/attractions/:id", (_ctx, [id]) => {
  const a = findAttraction(Number(id));
  if (!a) return fail(404, "ATTRACTION_NOT_FOUND", "없는 관광지예요.");
  const recommendable = recommendableMock(a.name);
  return ok({
    attractionId: a.attractionId,
    regionSigCd: a.sigCd,
    name: a.name,
    category: a.category,
    address: a.address,
    lat: a.lat,
    lng: a.lng,
    description: `${a.name}은(는) 목업 관광지예요. 실제 서버에서는 한국관광공사 원천 설명이 이 자리에 옵니다.`,
    images: [],
    useTime: "09:00~18:00",
    restDate: "매주 월요일",
    estimatedDurationMinutes: a.durationMinutes,
    estimated: true,
    recommendable,
    notRecommendableReasons: recommendable ? [] : ["MISSING_IMAGE"],
    sources: [{ name: "한국관광공사 TourAPI", contentId: String(a.attractionId), fetchedAt: "2026-10-01T00:00:00" }],
    oneLine: a.oneLine,
    tags: [],
    summaryBasis: "SOURCE_SUMMARY",
  });
});

// ── 코스 공유 링크 (4-9~4-13) ──
const SHARE_LINK_CODES = { notFound: "SHARE_LINK_NOT_FOUND", revoked: "SHARE_LINK_REVOKED", expired: "SHARE_LINK_EXPIRED" };

on("POST", "/courses/:id/share-links", ({ db: d, me, body }, [id]) => {
  const trip = findTrip(d, me!, id);
  const link = newLink(d, "sl_", trip.id, me!.id, daysOf(body));
  d.courseLinks.push(link);
  return issued(link);
});

on("GET", "/courses/:id/share-links", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  return ok(
    d.courseLinks
      .filter((l) => l.ownerId === trip.id)
      .sort((a, b) => b.id - a.id)
      .map((l) => ({ id: l.id, expiresAt: l.expiresAt, revoked: l.revoked, createdBy: userRef(d, l.createdBy), createdAt: l.createdAt })),
  );
});

on("DELETE", "/courses/:id/share-links/:linkId", ({ db: d, me }, [id, linkId]) => {
  const trip = findTrip(d, me!, id);
  const link = d.courseLinks.find((l) => l.id === Number(linkId) && l.ownerId === trip.id);
  if (!link) return fail(404, "SHARE_LINK_NOT_FOUND", "없는 공유 링크예요.");
  link.revoked = true;
  return ok(null, 204);
});

// 실제 서버는 303으로 cookie를 심고 4-13을 돌려줍니다. 목업은 바로 공유 코스를 줍니다.
on("GET", "/shared/courses/:token", ({ db: d }, [value]) => {
  const link = linkByToken(d.courseLinks, value, "sl_", SHARE_LINK_CODES);
  const trip = d.trips.find((t) => t.id === link.ownerId);
  if (!trip) return fail(404, "SHARE_LINK_NOT_FOUND", "없는 공유 링크예요.");
  const course = toCourse(trip, d.courses[trip.id] ?? null, { role: "VIEWER" });
  // 참여자 닉네임과 본인 전용 이유는 감춥니다
  return ok({
    ...course,
    tasteBasis: null,
    updatedBy: null,
    changes: course.changes
      ? { ...course.changes, removed: course.changes.removed.map((r) => ({ ...r, removedBy: null })), latest: course.changes.latest ? { ...course.changes.latest, by: null } : null }
      : null,
    days: course.days.map((day) => ({
      ...day,
      items: day.items.map((it) => (it.type === "ATTRACTION" ? { ...it, personalReason: null, change: it.change ? { ...it.change, by: null } : it.change } : it)),
    })),
  });
}, { auth: false });

/** 4-5·4-8 공통 수락 조건: 설문 완료, 끝나지 않은 여행, 8명 미만, 내 여행과 날짜가 겹치지 않음 */
function acceptInto(d: MockDb, me: MockUser, trip: MockTrip) {
  if (!d.submissions[me.id]) throw new MockError(409, "ONBOARDING_REQUIRED", "취향 설문을 먼저 마쳐 주세요.");
  if (isEnded(trip)) throw new MockError(409, "TRIP_ENDED", "끝난 여행에는 참여할 수 없어요.");
  if (trip.participants.includes(me.id)) return false;
  if (trip.participants.length >= MAX_PARTICIPANTS) throw new MockError(409, "TRIP_FULL", "이 여행은 8명이 모두 찼어요.");
  const conflicts = conflictsOf(d, me, trip.startDate, trip.endDate, trip.id);
  if (conflicts.length) throw new MockError(409, "TRIP_DATE_OVERLAP", "이미 있는 여행과 날짜가 겹칩니다.", { details: { conflicts } });
  joinTrip(trip, me.id);
  // 대기 중인 친구 초대가 있으면 함께 수락된 것으로 바뀝니다
  d.friendInvites.forEach((i) => {
    if (i.tripId === trip.id && i.invitee.userId === me.id && i.status === "PENDING") i.status = "ACCEPTED";
  });
  return true;
}

on("POST", "/invites/:token/accept", ({ db: d, me }, [value]) => {
  const { trip } = inviteByToken(d, value);
  const joined = acceptInto(d, me!, trip);
  return ok(publicTrip(trip), joined ? 201 : 200);
});

// ── 친구 초대 (4-6~4-8, 4-14, 4-15) ──
on("GET", "/trips/:id/friend-invites", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  return ok(
    d.friendInvites
      .filter((i) => i.tripId === trip.id)
      .sort((a, b) => b.id - a.id)
      .map(({ id: inviteId, invitee, inviter, status, createdAt }) => ({ id: inviteId, invitee, inviter, status, createdAt })),
  );
});

const friendsOf = (d: MockDb, me: MockUser) => FRIENDS.filter((f) => f.userId !== me.id && !(d.removedFriends[me.id] ?? []).includes(f.userId));

on("POST", "/trips/:id/friend-invites", ({ db: d, me, body }, [id]) => {
  const trip = findTrip(d, me!, id);
  if (isEnded(trip)) return fail(409, "TRIP_ENDED", "끝난 여행에는 초대할 수 없어요.");
  const friend = friendsOf(d, me!).find((f) => f.userId === body?.friendUserId);
  if (!friend) return fail(404, "FRIEND_NOT_FOUND", "친구가 아닌 회원이에요.");
  if (trip.participants.includes(friend.userId)) return fail(409, "INVITE_ALREADY_HANDLED", "이미 함께하는 친구예요.");
  const view = (i: MockFriendInvite) => ({ id: i.id, tripId: i.tripId, invitee: i.invitee, status: i.status, createdAt: i.createdAt });
  const pending = d.friendInvites.find((i) => i.tripId === trip.id && i.invitee.userId === friend.userId && i.status === "PENDING");
  if (pending) return ok(view(pending));
  const invite: MockFriendInvite = {
    id: ++d.seq,
    tripId: trip.id,
    invitee: { userId: friend.userId, nickname: friend.nickname },
    inviter: userRef(d, me!.id),
    status: "PENDING",
    createdAt: nowIso(),
  };
  d.friendInvites.push(invite);
  // 목업: 서현은 몇 초 뒤 수락한 것처럼 처리합니다 (참여 완료 표시 확인용)
  if (friend.userId === 13 && !IS_TEST) {
    setTimeout(() => {
      if (invite.status !== "PENDING") return;
      invite.status = "ACCEPTED";
      joinTrip(trip, 13);
      save();
    }, 4000);
  }
  return ok(view(invite), 201);
});

on("DELETE", "/trips/:id/friend-invites/:inviteId", ({ db: d, me }, [id, inviteId]) => {
  const trip = findTrip(d, me!, id);
  const invite = d.friendInvites.find((i) => i.id === Number(inviteId) && i.tripId === trip.id);
  if (!invite) return fail(404, "INVITE_NOT_FOUND", "없는 초대예요.");
  if (invite.status !== "PENDING") return fail(409, "INVITE_ALREADY_HANDLED", "이미 처리된 초대예요.");
  invite.status = "CANCELLED";
  return ok(null, 204);
});

/**
 * 받은 초대 시연용: 회원마다 한 번, 친구 민지가 만든 강릉 여행(코스 있음)에 초대받은 상태를 만들어 둡니다.
 * 목업 친구는 실제 회원이 아니라서 이렇게 하지 않으면 "받은 초대"(D2a)를 볼 방법이 없습니다.
 */
function ensureDemoInvite(d: MockDb, me: MockUser) {
  if (d.seededFor.includes(me.id)) return;
  d.seededFor.push(me.id);
  const startDate = addDays(today(), 21);
  const trip: MockTrip = {
    id: ++d.seq,
    startDate,
    endDate: addDays(startDate, 1),
    nights: 1,
    transport: "CAR",
    originLat: null,
    originLng: null,
    regionSigCd: "51150",
    regionSelection: "RANDOM",
    scheduleDensity: "RELAXED",
    hasCourse: false,
    retroactive: false,
    version: 0,
    participants: [],
    joinedAt: {},
    createdBy: 12,
    firstGeneratedAt: null,
  };
  joinTrip(trip, 12);
  joinTrip(trip, 13);
  const { course } = generateCourse({ trip, requester: userRef(d, 12), density: "RELAXED", tasteMode: "TASTE", submission: undefined });
  d.courses[trip.id] = course;
  trip.hasCourse = true;
  trip.firstGeneratedAt = nowIso();
  trip.version = 1;
  d.trips.push(trip);
  d.friendInvites.push({ id: ++d.seq, tripId: trip.id, invitee: userRef(d, me.id), inviter: userRef(d, 12), status: "PENDING", createdAt: nowIso() });
}

on("GET", "/me/trip-invites", ({ db: d, me }) => {
  ensureDemoInvite(d, me!);
  return ok(
    d.friendInvites
      .filter((i) => i.invitee.userId === me!.id && i.status === "PENDING")
      .sort((a, b) => b.id - a.id)
      .flatMap((i) => {
        const trip = d.trips.find((t) => t.id === i.tripId);
        if (!trip) return [];
        return [
          {
            id: i.id,
            trip: {
              tripId: trip.id,
              title: tripTitle(d, trip),
              startDate: trip.startDate,
              endDate: trip.endDate,
              regionName: regionName(trip.regionSigCd),
              heroImageUrl: null,
              participants: trip.participants.map((uid) => ({ nickname: nicknameOf(d, uid) })),
            },
            inviter: i.inviter,
            dateConflict: conflictsOf(d, me!, trip.startDate, trip.endDate, trip.id).length > 0,
            createdAt: i.createdAt,
          },
        ];
      }),
  );
});

const receivedInvite = (d: MockDb, me: MockUser, id: string) => {
  const invite = d.friendInvites.find((i) => i.id === Number(id) && i.invitee.userId === me.id);
  const trip = invite && d.trips.find((t) => t.id === invite.tripId);
  if (!invite || !trip) throw new MockError(404, "INVITE_NOT_FOUND", "없는 초대예요.");
  if (invite.status !== "PENDING") throw new MockError(409, "INVITE_ALREADY_HANDLED", "이미 처리된 초대예요.");
  return { invite, trip };
};

on("POST", "/me/trip-invites/:id/accept", ({ db: d, me }, [id]) => {
  const { invite, trip } = receivedInvite(d, me!, id);
  acceptInto(d, me!, trip);
  invite.status = "ACCEPTED";
  return ok(publicTrip(trip), 201);
});

on("POST", "/me/trip-invites/:id/decline", ({ db: d, me }, [id]) => {
  const { invite } = receivedInvite(d, me!, id);
  invite.status = "DECLINED";
  return ok(null, 204);
});

// ── 코스 (5장) ──
const courseOf = (d: MockDb, trip: MockTrip) => {
  const course = d.courses[trip.id];
  if (!course) throw new MockError(404, "COURSE_NOT_FOUND", "아직 코스가 없어요.");
  return course;
};

on("POST", "/courses/:id/generate", ({ db: d, me, body }, [id]) => {
  const trip = findTrip(d, me!, id);
  assertEditable(trip);
  // 최초 코스는 여행을 만든 사람만 (그 사람이 나갔으면 누구나)
  if (!trip.firstGeneratedAt && trip.participants.includes(trip.createdBy) && trip.createdBy !== me!.id)
    return fail(403, "COURSE_CREATOR_ONLY", "첫 코스는 여행을 만든 사람이 만들어요.");
  if (!trip.regionSigCd) return fail(409, "TRIP_REGION_NOT_SELECTED", "여행 지역을 먼저 정해 주세요.");
  if (body?.tasteMode !== undefined && body.tasteMode !== "TASTE" && body.tasteMode !== "RANDOM") return fail(400, "COMMON_INVALID_REQUEST", "tasteMode 값이 올바르지 않습니다.");
  const density = densityFor(d, me!, body?.scheduleDensity ?? trip.scheduleDensity);
  assertVersion(trip, body?.version);
  const tasteMode: TasteMode = body?.tasteMode ?? d.preferences[me!.id] ?? "TASTE";
  const { course, warnings } = generateCourse({ trip, requester: userRef(d, me!.id), density, tasteMode, submission: d.submissions[me!.id] });
  d.courses[trip.id] = course;
  trip.scheduleDensity = density;
  trip.hasCourse = true;
  trip.firstGeneratedAt ??= nowIso();
  trip.version += 1;
  return ok(toCourse(trip, course, { role: "PARTICIPANT", warnings }), 201);
});

on("GET", "/courses/:id", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  return ok(toCourse(trip, courseOf(d, trip), { role: "PARTICIPANT" }));
});

on("PATCH", "/courses/:id/schedule", ({ db: d, me, body }, [id]) => {
  const trip = findTrip(d, me!, id);
  assertEditable(trip);
  const course = courseOf(d, trip);
  assertVersion(trip, body?.version);
  // 복사본에 차례로 적용하고, 모두 성공했을 때만 바꿉니다 (전부 적용 또는 전부 거부)
  d.courses[trip.id] = applyOperations(trip, course, body?.operations, userRef(d, me!.id));
  trip.version += 1;
  return ok(toCourse(trip, d.courses[trip.id], { role: "PARTICIPANT" }));
});

on("GET", "/courses/:id/alternatives", ({ db: d, me, query }, [id]) => {
  const trip = findTrip(d, me!, id);
  assertEditable(trip);
  const course = courseOf(d, trip);
  return ok(alternatives(trip, course, { itemId: query.get("itemId"), category: query.get("category"), limit: query.get("limit"), q: query.get("q") }));
});

on("GET", "/courses/:id/restaurants/recommendations", ({ db: d, me, query }, [id]) => {
  const trip = findTrip(d, me!, id);
  assertEditable(trip);
  return ok(restaurantRecommendations(trip, courseOf(d, trip), query.get("itemId"), query.get("radius")));
});

on("GET", "/courses/:id/restaurants/search", ({ db: d, me, query }, [id]) => {
  const trip = findTrip(d, me!, id);
  assertEditable(trip);
  return ok(
    restaurantSearch(trip, courseOf(d, trip), { itemId: query.get("itemId"), query: query.get("query"), radius: query.get("radius"), page: query.get("page") }),
  );
});

on("GET", "/courses/:id/first-leg", ({ db: d, me, query }, [id]) => {
  const trip = findTrip(d, me!, id);
  return ok(firstLeg(trip, courseOf(d, trip), query.get("dayIndex"), query.get("lat"), query.get("lng")));
});

on("GET", "/courses/:id/routes", ({ db: d, me, query }, [id]) => {
  const trip = findTrip(d, me!, id);
  return ok(routes(trip, courseOf(d, trip), query.get("dayIndex"), query.get("transport")));
});

// ── 친구 ──
on("GET", "/friends", ({ db: d, me }) => ok(friendsOf(d, me!)));

on("DELETE", "/friends/:userId", ({ db: d, me }, [userId]) => {
  const friend = friendsOf(d, me!).find((f) => f.userId === Number(userId));
  if (!friend) return fail(404, "FRIEND_NOT_FOUND", "친구가 아닌 회원이에요.");
  d.removedFriends[me!.id] = [...(d.removedFriends[me!.id] ?? []), friend.userId];
  return ok(null, 204);
});

const daysOf = (body: Record<string, unknown> | undefined) => {
  const days = Number(body?.expiresInDays ?? 7);
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new MockError(400, "INVALID_EXPIRES_IN_DAYS", "만료 기간은 1~30일입니다.");
  return days;
};
const newLink = (d: MockDb, prefix: string, ownerId: number, createdBy: number, days: number): MockLink => ({
  id: ++d.seq,
  ownerId,
  token: token(prefix),
  createdBy,
  expiresAt: new Date(Date.now() + days * 86400000).toISOString().slice(0, 19),
  createdAt: nowIso(),
  revoked: false,
  acceptedCount: 0,
});
const issued = (l: MockLink) => ok({ id: l.id, token: l.token, expiresAt: l.expiresAt, createdAt: l.createdAt }, 201);
/** 링크 token 확인: 다른 용도(400)·없음(404)·폐기·만료(410) */
function linkByToken(links: MockLink[], value: string, prefix: string, codes: { notFound: string; revoked: string; expired: string }) {
  if (!value.startsWith(prefix)) throw new MockError(400, "TOKEN_AUDIENCE_MISMATCH", "다른 용도의 링크예요.");
  const link = links.find((l) => l.token === value);
  if (!link) throw new MockError(404, codes.notFound, "없는 링크예요.");
  if (link.revoked) throw new MockError(410, codes.revoked, "취소된 링크예요.");
  if (link.expiresAt < nowIso()) throw new MockError(410, codes.expired, "만료된 링크예요.");
  return link;
}
const FRIEND_LINK_CODES = { notFound: "FRIEND_LINK_NOT_FOUND", revoked: "FRIEND_LINK_REVOKED", expired: "FRIEND_LINK_EXPIRED" };

on("POST", "/friend-links", ({ db: d, me, body }) => {
  const link = newLink(d, "fl_", me!.id, me!.id, daysOf(body));
  d.friendLinks.push(link);
  return issued(link);
});

on("GET", "/friend-links", ({ db: d, me }) =>
  ok(
    d.friendLinks
      .filter((l) => l.ownerId === me!.id)
      .sort((a, b) => b.id - a.id)
      .map((l) => ({ id: l.id, expiresAt: l.expiresAt, revoked: l.revoked, acceptedCount: l.acceptedCount, createdAt: l.createdAt })),
  ),
);

on("DELETE", "/friend-links/:id", ({ db: d, me }, [id]) => {
  const link = d.friendLinks.find((l) => l.id === Number(id) && l.ownerId === me!.id);
  if (!link) return fail(404, "FRIEND_LINK_NOT_FOUND", "없는 친구 초대 링크예요.");
  link.revoked = true;
  return ok(null, 204);
});

// 목업 친구 링크는 누가 보냈는지 저장하지 않으므로, 첫 목업 친구가 보낸 링크로 봅니다 (끊었던 친구면 다시 친구가 됩니다).
const linkOwner = () => FRIENDS[0];
on("GET", "/friend-links/by-token/:token", ({ db: d }, [t]) => {
  if (!t.startsWith("fl_")) return fail(400, "TOKEN_AUDIENCE_MISMATCH", "친구 초대 링크가 아니에요.");
  // 이 목업에서 발급한 링크면 폐기·만료를 확인합니다 (예전 목업 링크는 그대로 열림)
  if (d.friendLinks.some((l) => l.token === t)) linkByToken(d.friendLinks, t, "fl_", FRIEND_LINK_CODES);
  return ok({ valid: true, inviterNickname: linkOwner().nickname });
}, { auth: false });

on("POST", "/friend-links/by-token/:token/accept", ({ db: d, me }, [t]) => {
  if (!t.startsWith("fl_")) return fail(400, "TOKEN_AUDIENCE_MISMATCH", "친구 초대 링크가 아니에요.");
  const stored = d.friendLinks.some((l) => l.token === t) ? linkByToken(d.friendLinks, t, "fl_", FRIEND_LINK_CODES) : null;
  const owner = linkOwner();
  const removed = d.removedFriends[me!.id] ?? [];
  const already = !removed.includes(owner.userId);
  if (stored && !already) stored.acceptedCount += 1;
  d.removedFriends[me!.id] = removed.filter((id) => id !== owner.userId);
  return ok(owner, already ? 200 : 201);
});

// ── 여행기·여행 지도 (6장) ──
const DIARY_TAGS = new Set(["자연", "바다", "산", "산책", "골목", "역사", "시장", "로컬 음식", "카페", "휴식", "실내", "체험"]);
const DIARY_FIELDS = ["body", "visibility", "locationPrecision", "satisfaction", "experienceTags", "includeInTasteProfile", "coverPhotoId"] as const;

const diaryView = (x: MockDiary, owner: boolean): Diary => {
  const { ownerId: _o, regionName: _r, regionLat: _la, regionLng: _ln, includeInTasteProfile, ...rest } = x;
  return owner ? { ...rest, includeInTasteProfile } : rest;
};
const findMyDiary = (d: MockDb, me: MockUser, id: string) => {
  const diary = d.diaries.find((x) => x.diaryId === Number(id) && x.ownerId === me.id);
  if (!diary) throw new MockError(404, "DIARY_NOT_FOUND", "여행기를 찾을 수 없어요.");
  return diary;
};
const pinOf = (x: MockDiary) => {
  const cover = x.photos.find((p) => p.photoId === x.coverPhotoId) ?? null;
  return {
    diaryId: x.diaryId,
    title: x.title,
    courseTitle: x.courseTitle,
    coverPhotoUrl: cover?.thumbnailUrl ?? null,
    visitedAt: x.visitedFrom,
    regionSigCd: x.regionSigCd,
    regionName: x.regionName,
    lat: cover?.lat ?? x.regionLat ?? 36.5,
    lng: cover?.lng ?? x.regionLng ?? 127.8,
    locationPrecision: x.locationPrecision,
    visibility: x.visibility,
    status: x.status,
  };
};
const invalidDiaryPatch = (diary: MockDiary, b: Record<string, unknown>): string | null => {
  if (b.title !== undefined && (typeof b.title !== "string" || b.title.trim().length < 1 || b.title.trim().length > 60)) return "제목은 1~60자예요.";
  if (b.body !== undefined && (typeof b.body !== "string" || b.body.length > 5000)) return "본문은 5000자까지예요.";
  const sat = b.satisfaction;
  if (sat !== undefined && sat !== null && !(Number.isInteger(sat) && (sat as number) >= 1 && (sat as number) <= 5)) return "만족도는 1~5예요.";
  const tags = b.experienceTags;
  if (tags !== undefined && (!Array.isArray(tags) || tags.length > 5 || tags.some((t) => !DIARY_TAGS.has(t as string)))) return "경험 태그는 사전 안에서 5개까지예요.";
  if (b.photoOrder !== undefined) {
    const ids = diary.photos.map((p) => p.photoId).sort((a, c) => a - c);
    const order = [...(b.photoOrder as number[])].sort((a, c) => a - c);
    if (ids.join() !== order.join()) return "사진 순서가 올바르지 않아요.";
  }
  return null;
};

on("POST", "/courses/:id/diary", ({ db: d, me, body }, [id]) => {
  const trip = findTrip(d, me!, id);
  if (!isEnded(trip)) return fail(409, "TRIP_NOT_ENDED", "여행이 끝난 뒤에 여행기를 쓸 수 있어요.");
  const existing = d.diaries.find((x) => x.tripId === trip.id && x.ownerId === me!.id);
  if (existing) return fail(409, "DIARY_ALREADY_EXISTS_FOR_TRIP", "이 여행의 여행기가 이미 있어요.", { details: { diaryId: existing.diaryId } });
  const region = findRegion(trip.regionSigCd);
  const courseTitle = d.courses[trip.id]?.title ?? null;
  const requested = typeof body?.title === "string" ? body.title.trim() : "";
  const diary: MockDiary = {
    diaryId: ++d.seq,
    tripId: trip.id,
    status: "DRAFT",
    title: requested || courseTitle || `${trip.startDate} 여행`,
    body: null,
    courseTitle,
    regionSigCd: trip.regionSigCd,
    visitedFrom: trip.startDate,
    visitedTo: trip.endDate,
    visibility: "PRIVATE",
    locationPrecision: "CITY",
    satisfaction: null,
    experienceTags: [],
    includeInTasteProfile: true,
    coverPhotoId: null,
    photos: [],
    publishedAt: null,
    updatedAt: nowIso(),
    ownerId: me!.id,
    regionName: regionName(trip.regionSigCd),
    regionLat: region?.centerLat ?? null,
    regionLng: region?.centerLng ?? null,
  };
  d.diaries.push(diary);
  return ok(diaryView(diary, true), 201);
});

on("GET", "/diaries/:id", ({ db: d, me }, [id]) => {
  const diary = d.diaries.find((x) => x.diaryId === Number(id));
  if (!diary) return fail(404, "DIARY_NOT_FOUND", "여행기를 찾을 수 없어요.");
  if (diary.ownerId === me!.id) return ok(diaryView(diary, true));
  const friend = friendsOf(d, me!).some((f) => f.userId === diary.ownerId);
  if (friend && diary.status === "PUBLISHED" && diary.visibility === "FRIENDS") return ok(diaryView(diary, false));
  return fail(404, "DIARY_NOT_FOUND", "여행기를 찾을 수 없어요.");
});

on("PATCH", "/diaries/:id", ({ db: d, me, body }, [id]) => {
  const diary = findMyDiary(d, me!, id);
  const b = (body ?? {}) as Record<string, unknown>;
  const invalid = invalidDiaryPatch(diary, b);
  if (invalid) return fail(400, "COMMON_INVALID_REQUEST", invalid);
  if (b.coverPhotoId !== undefined && !diary.photos.some((p) => p.photoId === b.coverPhotoId)) return fail(404, "DIARY_PHOTO_NOT_FOUND", "이 여행기의 사진이 아니에요.");
  if (b.photoOrder !== undefined) {
    diary.photos = (b.photoOrder as number[]).map((pid, i) => ({ ...diary.photos.find((p) => p.photoId === pid)!, order: i }));
  }
  for (const k of DIARY_FIELDS) {
    if (b[k] !== undefined) (diary as unknown as Record<string, unknown>)[k] = b[k];
  }
  if (typeof b.title === "string") diary.title = b.title.trim();
  diary.updatedAt = nowIso();
  return ok(diaryView(diary, true));
});

on("POST", "/diaries/:id/photos", ({ db: d, me, body }, [id]) => {
  const diary = findMyDiary(d, me!, id);
  const form = body as { getAll?: (k: string) => unknown[] } | undefined;
  const count = typeof form?.getAll === "function" ? form.getAll("files").length : 1;
  if (count < 1) return fail(400, "DIARY_PHOTO_INVALID", "사진을 골라 주세요.", { details: { fileIndex: 0 } });
  if (diary.photos.length + count > 30) return fail(400, "DIARY_PHOTO_LIMIT_EXCEEDED", "사진은 30장까지예요.");
  const added = Array.from({ length: count }, (_, i) => {
    const photoId = ++d.seq;
    return {
      photoId,
      url: `https://picsum.photos/seed/tripin-${photoId}/900/900`,
      thumbnailUrl: `https://picsum.photos/seed/tripin-${photoId}/300/300`,
      takenAt: null,
      lat: null,
      lng: null,
      order: diary.photos.length + i,
    };
  });
  diary.photos.push(...added);
  diary.coverPhotoId ??= added[0].photoId;
  diary.updatedAt = nowIso();
  return ok({ photos: added }, 201);
});

on("DELETE", "/diaries/:id/photos/:photoId", ({ db: d, me }, [id, photoId]) => {
  const diary = findMyDiary(d, me!, id);
  if (!diary.photos.some((p) => p.photoId === Number(photoId))) return fail(404, "DIARY_PHOTO_NOT_FOUND", "이 여행기의 사진이 아니에요.");
  diary.photos = diary.photos.filter((p) => p.photoId !== Number(photoId));
  if (diary.coverPhotoId === Number(photoId)) diary.coverPhotoId = diary.photos[0]?.photoId ?? null;
  return ok(null, 204);
});

on("POST", "/diaries/:id/publish", ({ db: d, me }, [id]) => {
  const diary = findMyDiary(d, me!, id);
  if (!diary.title.trim()) return fail(422, "DIARY_NOT_PUBLISHABLE", "제목이 필요해요.", { details: { missing: ["TITLE"] } });
  if (diary.status !== "PUBLISHED") {
    diary.status = "PUBLISHED";
    diary.publishedAt = nowIso();
  }
  return ok(diaryView(diary, true));
});

on("DELETE", "/diaries/:id", ({ db: d, me }, [id]) => {
  const diary = findMyDiary(d, me!, id);
  d.diaries = d.diaries.filter((x) => x !== diary);
  return ok(null, 204);
});

on("POST", "/diaries/:id/share-links", ({ db: d, me }, [id]) => {
  const diary = findMyDiary(d, me!, id);
  const missing = [...(diary.status === "PUBLISHED" ? [] : ["PUBLISHED"]), ...(diary.visibility === "LINK" ? [] : ["VISIBILITY_LINK"])];
  if (missing.length > 0) return fail(422, "DIARY_NOT_PUBLISHABLE", "발행하고 링크 공개로 바꿔 주세요.", { details: { missing } });
  const link = newLink(d, "dl_", diary.diaryId, me!.id, 7);
  d.diaryLinks.push(link);
  return issued(link);
});

on("GET", "/diaries/:id/share-links", ({ db: d, me }, [id]) => {
  const diary = findMyDiary(d, me!, id);
  return ok(
    d.diaryLinks
      .filter((l) => l.ownerId === diary.diaryId)
      .sort((a, b) => b.id - a.id)
      .map((l) => ({ id: l.id, expiresAt: l.expiresAt, revoked: l.revoked, createdAt: l.createdAt })),
  );
});

on("DELETE", "/diaries/:id/share-links/:linkId", ({ db: d, me }, [id, linkId]) => {
  const diary = findMyDiary(d, me!, id);
  const link = d.diaryLinks.find((l) => l.id === Number(linkId) && l.ownerId === diary.diaryId);
  if (!link) return fail(404, "DIARY_SHARE_LINK_NOT_FOUND", "없는 공유 링크예요.");
  link.revoked = true;
  return ok(null, 204);
});

on("GET", "/shared/diaries/:token", ({ db: d }, [value]) => {
  const link = linkByToken(d.diaryLinks, value, "dl_", { notFound: "DIARY_SHARE_LINK_NOT_FOUND", revoked: "DIARY_SHARE_LINK_REVOKED", expired: "DIARY_SHARE_LINK_EXPIRED" });
  const diary = d.diaries.find((x) => x.diaryId === link.ownerId);
  if (!diary || diary.status !== "PUBLISHED" || diary.visibility !== "LINK") return fail(404, "DIARY_SHARE_LINK_NOT_FOUND", "없는 공유 링크예요.");
  return ok(diaryView(diary, false));
}, { auth: false });

on("GET", "/me/travel-map", ({ db: d, me }) =>
  ok(
    d.diaries
      .filter((x) => x.ownerId === me!.id)
      .sort((a, c) => a.visitedFrom.localeCompare(c.visitedFrom))
      .map(pinOf),
  ),
);

on("GET", "/friends/:userId/travel-map", ({ db: d, me }, [userId]) => {
  if (!friendsOf(d, me!).some((f) => f.userId === Number(userId))) return fail(403, "FRIEND_REQUIRED", "친구만 볼 수 있어요.");
  return ok(d.diaries.filter((x) => x.ownerId === Number(userId) && x.status === "PUBLISHED" && x.visibility === "FRIENDS").map(pinOf));
});

// ── 진입점 ──
export async function mockFetch(method: string, pathWithQuery: string, body: unknown, headers: Record<string, string>): Promise<Raw> {
  const d = await load();
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  const [path, qs = ""] = pathWithQuery.split("?");
  // RN의 URLSearchParams 구현이 버전마다 달라 직접 파싱합니다.
  const params = new Map(
    qs
      .split("&")
      .filter(Boolean)
      .map((pair) => pair.split("=").map(decodeURIComponent) as [string, string]),
  );
  const query = { get: (key: string) => params.get(key) ?? null };

  for (const [m, re, handler, opts] of routes_) {
    if (m !== method) continue;
    const match = path.match(re);
    if (!match) continue;
    let me: MockUser | null = null;
    if (opts?.auth !== false) {
      const auth = headers.Authorization;
      const userId = auth?.startsWith("Bearer mock.") ? Number(auth.split(".")[1]) : null;
      me = d.users.find((u) => u.id === userId) ?? null;
      if (!me || !d.sessions.includes(me.id)) return fail(401, "AUTH_UNAUTHENTICATED", "로그인이 필요합니다.");
    }
    let res: Raw;
    try {
      res = handler({ db: d, me, body, query }, match.slice(1).map(decodeURIComponent));
    } catch (e) {
      if (!(e instanceof MockError)) throw e;
      res = fail(e.status, e.code, e.message, e.extra);
    }
    save();
    return res;
  }
  return fail(404, "COMMON_NOT_FOUND", `목업에 없는 API입니다: ${method} ${path}`);
}
