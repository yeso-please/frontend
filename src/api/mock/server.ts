// 개발용 목업 서버. EXPO_PUBLIC_API_MOCK=true 일 때 client.ts가 fetch 대신 이 함수를 부릅니다.
// 실제 백엔드(docs/frontend-api-guide.md)와 같은 경로·응답 모양·오류 코드를 흉내 냅니다. 데이터는 개발용 가짜 값입니다.
import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  AuthResponse,
  FriendInvite,
  OnboardingQuestions,
  OnboardingSubmission,
  OnboardingSubmissionRequest,
  Region,
  RegionCard,
  ScheduleDensity,
  TripContext,
} from "../types";
import regionsData from "./regions.json";

type Raw = { status: number; json: unknown };
type MockUser = { id: number; email: string; password: string; nickname: string };
type MockTrip = TripContext & { participants: number[]; createdBy: number };
type MockDb = {
  users: MockUser[];
  sessionUserId: number | null;
  submissions: Record<number, OnboardingSubmission>;
  trips: MockTrip[];
  friendInvites: FriendInvite[];
  invites: { id: number; tripId: number; token: string; createdBy: number; expiresAt: string; createdAt: string; revoked: boolean }[];
  seq: number;
};

const STORAGE_KEY = "tripin.mock.db.v1";
const LATENCY_MS = 350;

const FRIENDS = [
  { userId: 12, nickname: "민지", since: "2026-09-20T12:00:00" },
  { userId: 13, nickname: "서현", since: "2026-09-21T12:00:00" },
  { userId: 14, nickname: "지우", since: "2026-09-28T12:00:00" },
];

const seedDb = (): MockDb => ({
  users: [{ id: 1, email: "demo@tripin.app", password: "tripin1234", nickname: "수정" }],
  sessionUserId: null,
  submissions: {},
  trips: [],
  friendInvites: [],
  invites: [],
  seq: 100,
});

let db: MockDb | null = null;

async function load(): Promise<MockDb> {
  if (db) return db;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    db = saved ? (JSON.parse(saved) as MockDb) : seedDb();
  } catch {
    db = seedDb();
  }
  return db;
}

const save = () => {
  if (db) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db)).catch(() => undefined);
};

/** 목업 데이터를 처음 상태로 되돌립니다 (MY 화면 개발자 메뉴 등에서 사용) */
export async function resetMockDb() {
  db = seedDb();
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ── 공통 헬퍼 ──
const ok = (json: unknown, status = 200): Raw => ({ status, json });
const fail = (status: number, code: string, message: string, extra?: Partial<{ fieldErrors: unknown; details: unknown }>): Raw => ({
  status,
  json: { timestamp: new Date().toISOString(), status, code, message, ...extra },
});
const nowIso = () => new Date().toISOString().slice(0, 19);
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toYmd(d);
};
const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const token = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;

// ── 지역 ──
// 실제 개발 RDS의 일수별 추첨 가능 지역 수(1일 242 … 7일 23, 2026-10-01 런북)를 비슷하게 흉내 냅니다.
const ELIGIBLE_RATIO: Record<number, number> = { 1: 0.97, 2: 0.82, 3: 0.31, 4: 0.19, 5: 0.16, 6: 0.12, 7: 0.09 };
const BASE_REGIONS = regionsData as Omit<Region, "drawEligible" | "ineligibleReasons">[];
const score = (sigCd: string) => {
  let h = 0;
  for (const ch of sigCd) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return (h % 1000) / 1000;
};
// 시연용 대표 지역은 긴 여행에도 뽑히도록 둡니다.
const SHOWCASE = new Set(["51150", "47130", "26350", "50110", "46130", "52111"]);
const isEligible = (sigCd: string, days: number, density: ScheduleDensity) => {
  if (SHOWCASE.has(sigCd)) return true;
  const ratio = ELIGIBLE_RATIO[Math.min(7, Math.max(1, days))] * (density === "PACKED" ? 0.7 : 1);
  return score(sigCd) < ratio;
};
const regionName = (sigCd: string | null) => {
  const r = BASE_REGIONS.find((x) => x.sigCd === sigCd);
  return r ? `${r.province} ${r.city}` : null;
};

const CARDS: Record<string, Partial<RegionCard>> = {
  "51150": {
    title: "바다와 카페 사이, 느긋하게 머무는 곳",
    characteristics: ["바다", "카페", "감성여행"],
    landmarks: [
      { attractionId: 9001, name: "안목해변", thumbnailUrl: null },
      { attractionId: 9002, name: "오죽헌", thumbnailUrl: null },
    ],
  },
  "47130": {
    title: "천년의 시간이 머무는 도시",
    characteristics: ["역사 유적", "야경"],
    landmarks: [
      { attractionId: 9011, name: "대릉원", thumbnailUrl: null },
      { attractionId: 9012, name: "불국사", thumbnailUrl: null },
    ],
  },
  "50110": {
    title: "오름과 바다가 번갈아 펼쳐지는 섬",
    characteristics: ["자연", "바다", "산책"],
    landmarks: [{ attractionId: 9021, name: "사려니숲길", thumbnailUrl: null }],
  },
};

// ── 온보딩 ──
const QUESTIONS: OnboardingQuestions = {
  questionVersion: "aihub-traveler-v1",
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
};

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

// ── 라우터 ──
type Ctx = { db: MockDb; me: MockUser | null; body: any; query: { get: (key: string) => string | null } };
type Handler = (ctx: Ctx, params: string[]) => Raw;
const routes: [string, RegExp, Handler, { auth?: boolean }?][] = [];
const on = (method: string, pattern: string, handler: Handler, opts?: { auth?: boolean }) =>
  routes.push([method, new RegExp(`^${pattern.replace(/:\w+/g, "([^/]+)")}$`), handler, opts]);

const authResponse = (u: MockUser, d: MockDb): AuthResponse => ({
  user: { id: u.id, email: u.email, nickname: u.nickname, profileImage: null },
  accessToken: `mock.${u.id}.${Date.now()}`,
  tokenType: "Bearer",
  expiresInSeconds: 1800,
  onboardingCompleted: !!d.submissions[u.id],
});

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
  d.sessionUserId = user.id;
  return ok(authResponse(user, d), 201);
}, { auth: false });

on("POST", "/auth/login", ({ db: d, body }) => {
  const user = d.users.find((u) => u.email === String(body?.email ?? "").trim().toLowerCase() && u.password === body?.password);
  if (!user) return fail(401, "AUTH_INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
  d.sessionUserId = user.id;
  return ok(authResponse(user, d));
}, { auth: false });

on("POST", "/auth/refresh", ({ db: d }) => {
  const user = d.users.find((u) => u.id === d.sessionUserId);
  if (!user) return fail(401, "AUTH_INVALID_REFRESH_TOKEN", "다시 로그인해 주세요.");
  return ok(authResponse(user, d));
}, { auth: false });

on("POST", "/auth/logout", ({ db: d }) => {
  d.sessionUserId = null;
  return ok(null, 204);
}, { auth: false });

on("GET", "/users/me", ({ db: d, me }) => ok({ id: me!.id, email: me!.email, nickname: me!.nickname, profileImage: null, onboardingCompleted: !!d.submissions[me!.id] }));

on("GET", "/onboarding/questions", () => ok(QUESTIONS), { auth: false });

on("POST", "/onboarding/submissions", ({ db: d, me, body }) => {
  const req = body as OnboardingSubmissionRequest;
  if (req.questionVersion !== QUESTIONS.questionVersion) return fail(400, "ONBOARDING_INVALID_QUESTION_VERSION", "설문이 바뀌었어요. 다시 불러와 주세요.");
  const keys = ["1", "3", "5", "6"];
  if (!keys.every((k) => Number.isInteger(req.travelStyles?.[k]) && req.travelStyles[k] >= 1 && req.travelStyles[k] <= 7))
    return fail(400, "ONBOARDING_INVALID_TRAVEL_STYLES", "여행 스타일 답이 올바르지 않습니다.");
  if ((req.travelMotives ?? []).length > 3) return fail(400, "ONBOARDING_INVALID_TRAVEL_MOTIVE", "여행 동기는 최대 3개입니다.");
  if ((req.likedRegions ?? []).length > 3) return fail(400, "ONBOARDING_TOO_MANY_LIKED_REGIONS", "좋아하는 지역은 최대 3곳입니다.");
  if (!["RELAXED", "PACKED"].includes(req.scheduleDensity)) return fail(400, "ONBOARDING_INVALID_SCHEDULE_DENSITY", "일정 밀도를 골라 주세요.");
  const submission: OnboardingSubmission = {
    ...req,
    travelMotives: req.travelMotives ?? [],
    likedRegions: req.likedRegions ?? [],
    excludeTags: req.excludeTags ?? [],
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

on("GET", "/regions/:sigCd/card", (_ctx, [sigCd]) => {
  const base = BASE_REGIONS.find((r) => r.sigCd === sigCd);
  if (!base) return fail(404, "REGION_NOT_FOUND", "없는 지역입니다.");
  const extra = CARDS[sigCd] ?? {};
  const card: RegionCard = {
    sigCd,
    province: base.province,
    city: base.city,
    title: base.city,
    introduction: [],
    heroImage: null,
    characteristics: [],
    historyHighlights: [],
    landmarks: [],
    sources: [],
    updatedAt: null,
    ...extra,
  };
  return ok(card);
});

// ── 여행 ──
const myTrips = (d: MockDb, me: MockUser) => d.trips.filter((t) => t.participants.includes(me.id));
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart <= bEnd && bStart <= aEnd;
const fallbackTitle = (t: { startDate: string; nights: number }) => {
  const [, m, dd] = t.startDate.split("-").map(Number);
  return t.nights === 0 ? `${m}월 ${dd}일 당일 여행` : `${m}월 ${dd}일부터 ${t.nights}박 ${t.nights + 1}일 여행`;
};
const publicTrip = ({ participants: _p, createdBy: _c, ...ctx }: MockTrip): TripContext => ctx;
const findTrip = (d: MockDb, me: MockUser, id: string) => myTrips(d, me).find((t) => t.id === Number(id));

on("GET", "/trips/unavailable-dates", ({ db: d, me, query }) => {
  const from = query.get("from") ?? "0000-01-01";
  const to = query.get("to") ?? "9999-12-31";
  return ok(myTrips(d, me!).filter((t) => overlaps(t.startDate, t.endDate, from, to)).map((t) => ({ tripId: t.id, startDate: t.startDate, endDate: t.endDate })));
});

on("POST", "/trips/context/check", ({ db: d, me, body }) => {
  const endDate = addDays(body.startDate, body.nights);
  const conflicts = myTrips(d, me!)
    .filter((t) => overlaps(t.startDate, t.endDate, body.startDate, endDate))
    .map((t) => ({ tripId: t.id, title: fallbackTitle(t), startDate: t.startDate, endDate: t.endDate }));
  const eligibleRegionCount = BASE_REGIONS.filter((r) => isEligible(r.sigCd, body.nights + 1, "RELAXED")).length;
  return ok({ available: conflicts.length === 0, endDate, conflicts, eligibleRegionCount });
});

on("POST", "/trips", ({ db: d, me, body }) => {
  if (!d.submissions[me!.id]) return fail(409, "ONBOARDING_REQUIRED", "취향 설문을 먼저 마쳐 주세요.");
  const tomorrow = addDays(toYmd(new Date()), 1);
  if (!body.startDate || body.startDate < tomorrow) return fail(400, "TRIP_INVALID_START_DATE", "여행은 내일부터 시작할 수 있어요.");
  if (!Number.isInteger(body.nights) || body.nights < 0 || body.nights > 6) return fail(400, "TRIP_INVALID_NIGHTS", "여행 기간은 당일~6박 7일입니다.");
  if (!["WALK", "CAR", "PUBLIC_TRANSIT"].includes(body.transport)) return fail(400, "TRIP_INVALID_TRANSPORT", "이동수단을 골라 주세요.");
  const endDate = addDays(body.startDate, body.nights);
  const conflicts = myTrips(d, me!).filter((t) => overlaps(t.startDate, t.endDate, body.startDate, endDate));
  if (conflicts.length)
    return fail(409, "TRIP_DATE_OVERLAP", "다른 여행과 날짜가 겹쳐요.", {
      details: { conflicts: conflicts.map((t) => ({ tripId: t.id, title: fallbackTitle(t), startDate: t.startDate, endDate: t.endDate })) },
    });
  const trip: MockTrip = {
    id: ++d.seq,
    startDate: body.startDate,
    endDate,
    nights: body.nights,
    transport: body.transport,
    originLat: body.originLat ?? null,
    originLng: body.originLng ?? null,
    regionSigCd: null,
    regionSelection: null,
    scheduleDensity: null,
    hasCourse: false,
    version: 0,
    participants: [me!.id],
    createdBy: me!.id,
  };
  d.trips.push(trip);
  return ok(publicTrip(trip), 201);
});

on("GET", "/trips", ({ db: d, me, query }) => {
  const period = query.get("period");
  const today = toYmd(new Date());
  return ok(
    myTrips(d, me!)
      .filter((t) => (period === "UPCOMING" ? t.endDate >= today : period === "PAST" ? t.endDate < today : true))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((t) => ({
        tripId: t.id,
        title: fallbackTitle(t),
        regionSigCd: t.regionSigCd,
        regionName: regionName(t.regionSigCd),
        startDate: t.startDate,
        endDate: t.endDate,
        nights: t.nights,
        participants: t.participants.map((id) => ({ userId: id, nickname: d.users.find((u) => u.id === id)?.nickname ?? FRIENDS.find((f) => f.userId === id)?.nickname ?? "여행자" })),
        hasCourse: t.hasCourse,
        myDiaryId: null,
        updatedAt: nowIso(),
      })),
  );
});

on("GET", "/trips/:id/context", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  return trip ? ok(publicTrip(trip)) : fail(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없어요.");
});

on("POST", "/trips/:id/region", ({ db: d, me, body }, [id]) => {
  const trip = findTrip(d, me!, id);
  if (!trip) return fail(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없어요.");
  if (body.version !== trip.version) return fail(409, "TRIP_VERSION_CONFLICT", "다른 참여자가 먼저 수정했어요.");
  const density: ScheduleDensity = body.scheduleDensity ?? trip.scheduleDensity ?? d.submissions[me!.id]?.scheduleDensity ?? "RELAXED";
  const days = trip.nights + 1;
  const candidates = BASE_REGIONS.filter((r) => isEligible(r.sigCd, days, density));
  let picked: (typeof BASE_REGIONS)[number] | undefined;
  if (body.mode === "MANUAL") {
    picked = BASE_REGIONS.find((r) => r.sigCd === body.sigCd);
    if (!picked) return fail(404, "REGION_NOT_FOUND", "없는 지역입니다.");
    if (!isEligible(picked.sigCd, days, density)) return fail(422, "DRAW_REGION_NOT_ELIGIBLE", "이 기간에 코스를 만들 관광지가 부족한 지역이에요.");
  } else {
    if (!candidates.length) return fail(422, "DRAW_NO_ELIGIBLE_REGION", "뽑을 수 있는 지역이 없어요.");
    picked = candidates[Math.floor(Math.random() * candidates.length)];
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
    appliedConditions: [],
    ignoredConditions: [],
    candidateCount: candidates.length,
    warnings: [],
    version: trip.version,
  });
});

on("GET", "/trips/:id/participants", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  if (!trip) return fail(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없어요.");
  return ok(
    trip.participants.map((uid) => ({
      userId: uid,
      nickname: d.users.find((u) => u.id === uid)?.nickname ?? FRIENDS.find((f) => f.userId === uid)?.nickname ?? "여행자",
      isCreator: uid === trip.createdBy,
      joinedAt: nowIso(),
    })),
  );
});

on("DELETE", "/trips/:id/participants/me", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  if (!trip) return fail(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없어요.");
  trip.participants = trip.participants.filter((uid) => uid !== me!.id);
  // 마지막 참여자가 나가면 여행·초대가 모두 지워집니다.
  if (trip.participants.length === 0) {
    d.trips = d.trips.filter((t) => t.id !== trip.id);
    d.invites = d.invites.filter((i) => i.tripId !== trip.id);
    d.friendInvites = d.friendInvites.filter((i) => i.tripId !== trip.id);
  }
  return ok(null, 204);
});

on("POST", "/trips/:id/invites", ({ db: d, me, body }, [id]) => {
  const trip = findTrip(d, me!, id);
  if (!trip) return fail(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없어요.");
  const days = Number(body?.expiresInDays ?? 7);
  if (days < 1 || days > 30) return fail(400, "INVALID_EXPIRES_IN_DAYS", "만료 기간은 1~30일입니다.");
  const expires = new Date(Date.now() + days * 86400000).toISOString().slice(0, 19);
  const link = { id: ++d.seq, tripId: trip.id, token: token("iv_"), createdBy: me!.id, expiresAt: expires, createdAt: nowIso(), revoked: false };
  d.invites.push(link);
  return ok({ id: link.id, token: link.token, expiresAt: link.expiresAt, createdAt: link.createdAt }, 201);
});

on("GET", "/trips/:id/friend-invites", ({ db: d, me }, [id]) => {
  const trip = findTrip(d, me!, id);
  if (!trip) return fail(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없어요.");
  return ok(d.friendInvites.filter((i) => i.tripId === trip.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

on("POST", "/trips/:id/friend-invites", ({ db: d, me, body }, [id]) => {
  const trip = findTrip(d, me!, id);
  if (!trip) return fail(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없어요.");
  const friend = FRIENDS.find((f) => f.userId === body?.friendUserId);
  if (!friend) return fail(404, "FRIEND_NOT_FOUND", "친구가 아닌 회원이에요.");
  if (trip.participants.includes(friend.userId)) return fail(409, "INVITE_ALREADY_HANDLED", "이미 함께하는 친구예요.");
  const pending = d.friendInvites.find((i) => i.tripId === trip.id && i.invitee.userId === friend.userId && i.status === "PENDING");
  if (pending) return ok(pending);
  const invite: FriendInvite = { id: ++d.seq, tripId: trip.id, invitee: { userId: friend.userId, nickname: friend.nickname }, status: "PENDING", createdAt: nowIso() };
  d.friendInvites.push(invite);
  // 목업: 서현은 몇 초 뒤 자동으로 수락한 것처럼 처리합니다 (설문 완료 상태 표시 확인용)
  if (friend.userId === 13) {
    setTimeout(() => {
      invite.status = "ACCEPTED";
      if (!trip.participants.includes(13)) trip.participants.push(13);
      save();
    }, 4000);
  }
  return ok(invite, 201);
});

on("DELETE", "/trips/:id/friend-invites/:inviteId", ({ db: d, me }, [id, inviteId]) => {
  const trip = findTrip(d, me!, id);
  if (!trip) return fail(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없어요.");
  const invite = d.friendInvites.find((i) => i.id === Number(inviteId) && i.tripId === trip.id);
  if (!invite) return fail(404, "INVITE_NOT_FOUND", "없는 초대예요.");
  if (invite.status !== "PENDING") return fail(409, "INVITE_ALREADY_HANDLED", "이미 처리된 초대예요.");
  invite.status = "CANCELLED";
  return ok(null, 204);
});

on("GET", "/friends", () => ok(FRIENDS));

on("POST", "/friend-links", ({ db: d }) => ok({ id: ++d.seq, token: token("fl_"), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 19), createdAt: nowIso() }, 201));

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

  for (const [m, re, handler, opts] of routes) {
    if (m !== method) continue;
    const match = path.match(re);
    if (!match) continue;
    let me: MockUser | null = null;
    if (opts?.auth !== false) {
      const auth = headers.Authorization;
      const userId = auth?.startsWith("Bearer mock.") ? Number(auth.split(".")[1]) : null;
      me = d.users.find((u) => u.id === userId) ?? null;
      if (!me || d.sessionUserId !== me.id) return fail(401, "AUTH_UNAUTHENTICATED", "로그인이 필요합니다.");
    }
    const res = handler({ db: d, me, body, query }, match.slice(1));
    save();
    return res;
  }
  return fail(404, "COMMON_NOT_FOUND", `목업에 없는 API입니다: ${method} ${path}`);
}
