// 목업 코스(백엔드 docs/api/trip.md 5장): 생성·조회·편집·대체 후보·식당·경로.
// 저장은 장소 id와 순서·변경 기록만 하고, 이름·좌표·이동 시간은 조회할 때마다 채웁니다(실제 서버와 같음).
import type {
  Alternatives,
  AttractionCategory,
  ChangeOrigin,
  Course,
  CourseChanges,
  CourseFirstLeg,
  CourseItem,
  CourseRoutes,
  CourseWarning,
  ItemChange,
  OnboardingSubmission,
  RecommendationMode,
  RestaurantCandidate,
  RestaurantRecommendations,
  RestaurantSearch,
  RestaurantSnapshot,
  ScheduleDensity,
  ScheduleOperation,
  TasteMode,
  Transport,
  UserRef,
} from "../types";
import { clone, MockError, nowIso } from "./common";
import {
  attractionsFor,
  CATEGORY_LABEL,
  distanceMeters,
  estimateMinutes,
  findAttraction,
  findRegion,
  regionName,
  regionShortName,
  restaurantsFor,
  straightLeg,
} from "./data";

type StoredAttraction = {
  itemId: string;
  type: "ATTRACTION";
  attractionId: number;
  source: "RECOMMEND" | "MANUAL";
  reason: string | null;
  change: ItemChange;
};
type StoredMeal = { itemId: string; type: "MEAL"; meal: "LUNCH" | "DINNER"; restaurant: RestaurantSnapshot | null };
type StoredItem = StoredAttraction | StoredMeal;
type Removal = CourseChanges["removed"][number];

export type MockCourse = {
  days: StoredItem[][];
  title: string;
  recommendationMode: RecommendationMode;
  tasteBasis: UserRef;
  baselineAt: string;
  removals: Removal[];
  latest: CourseChanges["latest"];
  updatedBy: UserRef;
  updatedAt: string;
  seq: number;
};

/** 코스 계산에 필요한 여행 정보 */
export type CourseTrip = {
  id: number;
  startDate: string;
  endDate: string;
  nights: number;
  transport: Transport;
  regionSigCd: string | null;
  scheduleDensity: ScheduleDensity | null;
  version: number;
};

const DENSITY_TARGET: Record<ScheduleDensity, number> = { RELAXED: 4, PACKED: 6 };
const CATEGORIES: AttractionCategory[] = ["NATURE", "HISTORY_CULTURE", "ACTIVITY", "WALK_REST", "ETC"];
const invalidOp = (message = "편집 요청이 올바르지 않습니다.") => new MockError(400, "COURSE_INVALID_OPERATION", message);
const dateOf = (trip: CourseTrip, dayIndex: number) => {
  const d = new Date(`${trip.startDate}T00:00:00`);
  d.setDate(d.getDate() + dayIndex);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shuffle = <T>(list: T[]) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// ── 추천 이유 (백엔드 "추천 이유" 표: 실제 설문 답과 관광지 유형이 맞을 때만) ──
function surveyReasons(category: AttractionCategory, sub: OnboardingSubmission | undefined): string[] {
  if (!sub) return [];
  const s = sub.travelStyles;
  const m = sub.travelMotives;
  const out: string[] = [];
  const left = (key: string) => s[key] >= 1 && s[key] <= 3;
  const right = (key: string) => s[key] >= 5 && s[key] <= 7;
  if ((category === "NATURE" || category === "WALK_REST") && left("1")) out.push("자연을 좋아하는 취향과 맞아요");
  if (category === "WALK_REST" && left("5")) out.push("휴식을 좋아하는 취향과 맞아요");
  if (category === "ACTIVITY" && right("5")) out.push("체험 활동을 좋아하는 취향과 맞아요");
  if (category === "WALK_REST" && m.includes(2)) out.push("'휴식과 재충전' 여행 동기와 맞아요");
  if (category === "ACTIVITY" && m.includes(6)) out.push("'운동과 건강' 여행 동기와 맞아요");
  if (category === "ACTIVITY" && m.includes(7)) out.push("'새로운 경험' 여행 동기와 맞아요");
  if (category === "HISTORY_CULTURE" && m.includes(8)) out.push("'역사와 문화 탐방' 여행 동기와 맞아요");
  return out;
}

// ── 생성 (5-1) ──
type GenerateInput = {
  trip: CourseTrip;
  requester: UserRef;
  density: ScheduleDensity;
  tasteMode: TasteMode;
  submission: OnboardingSubmission | undefined;
};

export function generateCourse({ trip, requester, density, tasteMode, submission }: GenerateInput): { course: MockCourse; warnings: CourseWarning[] } {
  const sigCd = trip.regionSigCd!;
  const days = trip.nights + 1;
  const target = DENSITY_TARGET[density];
  const pool = shuffle(attractionsFor(sigCd));
  const take = Math.min(pool.length, target * days);
  const perDay = Array.from({ length: days }, (_, i) => Math.floor(take / days) + (i < take % days ? 1 : 0));
  const empty = perDay.map((n, dayIndex) => ({ dayIndex, required: 1, available: n })).filter((d) => d.available === 0);
  if (empty.length) throw new MockError(422, "COURSE_INSUFFICIENT_CANDIDATES", "이 지역엔 코스를 채울 관광지가 부족해요.", { details: { days: empty } });

  const mode: RecommendationMode = tasteMode === "RANDOM" ? "RANDOM" : submission?.tasteStatus === "READY" ? "PERSONALIZED" : "RULE_BASED";
  const reasonUses = new Map<string, number>();
  let seq = 0;
  let cursor = 0;
  const restaurantsUsed = new Set<string>();
  const regionCenter = findRegion(sigCd)!;

  const dayItems: StoredItem[][] = perDay.map((count) => {
    const picks = pool.slice(cursor, cursor + count);
    cursor += count;
    // 동선: 서쪽에서 동쪽으로 단순 정렬
    picks.sort((a, b) => a.lng - b.lng);
    const items: StoredItem[] = picks.map((a) => {
      let reason: string | null = null;
      if (mode === "PERSONALIZED") {
        reason = surveyReasons(a.category, submission).find((r) => (reasonUses.get(r) ?? 0) < 2) ?? null;
        if (reason) reasonUses.set(reason, (reasonUses.get(reason) ?? 0) + 1);
      }
      return {
        itemId: `a-${++seq}`,
        type: "ATTRACTION",
        attractionId: a.attractionId,
        source: "RECOMMEND",
        reason,
        change: { origin: "BASE", by: null, replacedFrom: null, note: null, changedAt: null },
      };
    });
    // 점심은 그날 관광지의 절반 뒤, 저녁은 맨 끝
    const lunchAt = Math.ceil(items.length / 2);
    items.splice(lunchAt, 0, { itemId: `m-${++seq}`, type: "MEAL", meal: "LUNCH", restaurant: null });
    items.push({ itemId: `m-${++seq}`, type: "MEAL", meal: "DINNER", restaurant: null });
    // 식당 자동 배정: 앞 관광지(없으면 지역 중심)에서 5km 안, 가까운 10곳 중 무작위, 같은 식당 두 번 없음
    items.forEach((item, index) => {
      if (item.type !== "MEAL") return;
      const origin = previousAttraction(items, index) ?? { lat: regionCenter.centerLat, lng: regionCenter.centerLng };
      const near = restaurantsFor(sigCd)
        .filter((r) => !restaurantsUsed.has(r.externalId))
        .map((r) => ({ r, m: distanceMeters(origin, r) }))
        .filter((x) => x.m <= 5000)
        .sort((x, y) => x.m - y.m)
        .slice(0, 10);
      if (!near.length) return;
      const pick = near[Math.floor(Math.random() * near.length)].r;
      restaurantsUsed.add(pick.externalId);
      item.restaurant = pick;
    });
    return items;
  });

  const now = nowIso();
  const warnings: CourseWarning[] = [{ code: "ROUTE_TIME_ESTIMATED", dayIndex: null, itemId: null }];
  perDay.forEach((n, dayIndex) => {
    if (n < target) warnings.push({ code: "DENSITY_TARGET_NOT_MET", dayIndex, itemId: null });
  });
  return {
    course: {
      days: dayItems,
      title: ruleTitle(trip, dayItems),
      recommendationMode: mode,
      tasteBasis: requester,
      baselineAt: now,
      removals: [],
      latest: null,
      updatedBy: requester,
      updatedAt: now,
      seq,
    },
    warnings,
  };
}

/** 규칙 제목 "{지역명}, {대표 테마}를 따라 걷는 {일수}일" */
function ruleTitle(trip: CourseTrip, days: StoredItem[][]) {
  const region = findRegion(trip.regionSigCd)!;
  const counts = new Map<AttractionCategory, number>();
  days.flat().forEach((item) => {
    if (item.type !== "ATTRACTION") return;
    const c = findAttraction(item.attractionId)?.category;
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  });
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "NATURE";
  return `${regionShortName(region)}, ${CATEGORY_LABEL[top]}를 따라 걷는 ${days.length}일`;
}

function previousAttraction(items: StoredItem[], index: number) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.type === "ATTRACTION") {
      const a = findAttraction(item.attractionId);
      if (a) return { lat: a.lat, lng: a.lng, attractionId: a.attractionId };
    }
  }
  return null;
}

// ── 조회 모양 만들기 ──
type ViewOptions = { role: "PARTICIPANT" | "VIEWER"; warnings?: CourseWarning[] };

/** 저장된 코스를 Course 응답으로. course가 없으면 days: [] 인 빈 모양(4-13·4-16) */
export function toCourse(trip: CourseTrip, course: MockCourse | null, { role, warnings }: ViewOptions): Course {
  const base = {
    tripId: trip.id,
    version: trip.version,
    myRole: role,
    regionSigCd: trip.regionSigCd,
    regionName: regionName(trip.regionSigCd),
    startDate: trip.startDate,
    endDate: trip.endDate,
    scheduleDensity: trip.scheduleDensity,
  };
  if (!course) {
    return {
      ...base,
      title: null,
      titleSource: null,
      intro: null,
      introSource: null,
      aiGenerated: false,
      recommendationMode: null,
      tasteBasis: null,
      days: [],
      warnings: [],
      changes: null,
      updatedBy: null,
      updatedAt: null,
    };
  }
  const days = course.days.map((items, dayIndex) => ({ dayIndex, date: dateOf(trip, dayIndex), items: materializeDay(items, trip.transport) }));
  return {
    ...base,
    title: course.title,
    titleSource: "RULE",
    intro: null,
    introSource: null,
    aiGenerated: false,
    recommendationMode: course.recommendationMode,
    tasteBasis: course.tasteBasis,
    days,
    warnings: warnings ?? [{ code: "ROUTE_TIME_ESTIMATED", dayIndex: null, itemId: null }],
    changes: changesOf(course),
    updatedBy: course.updatedBy,
    updatedAt: course.updatedAt,
  };
}

/** 지점(관광지·식당을 고른 식사) 사이 이동을 채웁니다. 식당 미정 식사는 건너뜁니다. */
function materializeDay(items: StoredItem[], transport: Transport): CourseItem[] {
  let prev: { lat: number; lng: number } | null = null;
  return items.map((item) => {
    const point = item.type === "ATTRACTION" ? findAttraction(item.attractionId) ?? null : item.restaurant;
    const meters = prev && point ? distanceMeters(prev, point) : null;
    const travel = {
      travelFromPreviousMinutes: meters === null ? null : estimateMinutes(meters, transport),
      travelFromPreviousMeters: meters,
      travelFromPrevious: meters === null ? null : straightLeg(meters),
    };
    if (point) prev = point;
    if (item.type === "MEAL") {
      return { itemId: item.itemId, type: "MEAL", meal: item.meal, durationMinutes: 60, ...travel, restaurant: item.restaurant };
    }
    const a = findAttraction(item.attractionId)!;
    return {
      itemId: item.itemId,
      type: "ATTRACTION",
      attractionId: a.attractionId,
      name: a.name,
      category: a.category,
      thumbnailUrl: null,
      address: a.address,
      lat: a.lat,
      lng: a.lng,
      durationMinutes: a.durationMinutes,
      ...travel,
      estimated: true,
      source: item.source,
      reason: item.reason,
      reasonSource: item.reason ? "RULE" : null,
      personalReason: null,
      oneLine: a.oneLine,
      summaryBasis: "SOURCE_SUMMARY",
      change: item.change,
    };
  });
}

function changesOf(course: MockCourse): CourseChanges {
  return {
    baselineAt: course.baselineAt,
    days: course.days.map((items, dayIndex) => ({
      dayIndex,
      added: items.filter((i) => i.type === "ATTRACTION" && i.change.origin === "ADDED").length,
      replaced: items.filter((i) => i.type === "ATTRACTION" && i.change.origin === "REPLACED").length,
      removed: course.removals.filter((r) => r.dayIndex === dayIndex).length,
    })),
    removed: course.removals,
    latest: course.latest,
  };
}

// ── 편집 (5-3) ──
const findItem = (course: MockCourse, itemId: unknown) => {
  for (let dayIndex = 0; dayIndex < course.days.length; dayIndex += 1) {
    const index = course.days[dayIndex].findIndex((i) => i.itemId === itemId);
    if (index >= 0) return { dayIndex, index, item: course.days[dayIndex][index] };
  }
  throw new MockError(404, "COURSE_ITEM_NOT_FOUND", "코스에 없는 항목이에요.");
};
const inCourse = (course: MockCourse, attractionId: number) => course.days.some((items) => items.some((i) => i.type === "ATTRACTION" && i.attractionId === attractionId));
const checkNote = (note: unknown) => {
  if (note === undefined || note === null) return null;
  if (typeof note !== "string" || note.trim().length < 1 || note.length > 100) throw invalidOp("사유는 1~100자로 적어 주세요.");
  return note;
};
const checkDay = (course: MockCourse, dayIndex: unknown) => {
  if (!Number.isInteger(dayIndex) || (dayIndex as number) < 0 || (dayIndex as number) >= course.days.length) throw invalidOp("없는 날짜예요.");
  return dayIndex as number;
};
const checkPosition = (position: unknown, length: number) => {
  if (position === undefined || position === null) return length;
  if (!Number.isInteger(position) || (position as number) < 0 || (position as number) > length) throw invalidOp("위치가 올바르지 않아요.");
  return position as number;
};
function checkNewAttraction(course: MockCourse, trip: CourseTrip, attractionId: unknown) {
  if (!Number.isInteger(attractionId)) throw invalidOp();
  const a = findAttraction(attractionId as number);
  if (!a) throw new MockError(404, "ATTRACTION_NOT_FOUND", "없는 관광지예요.");
  if (a.sigCd !== trip.regionSigCd) throw new MockError(422, "ATTRACTION_REGION_MISMATCH", "여행 지역의 장소만 넣을 수 있어요.");
  if (inCourse(course, a.attractionId)) throw new MockError(409, "ATTRACTION_ALREADY_IN_COURSE", "이미 코스에 있는 장소예요.");
  return a;
}

/** operation을 차례로 적용합니다. 하나라도 실패하면 예외 — 호출한 쪽은 원본을 그대로 둡니다(전부 적용 또는 전부 거부). */
export function applyOperations(trip: CourseTrip, original: MockCourse, operations: unknown, me: UserRef): MockCourse {
  if (!Array.isArray(operations) || operations.length < 1 || operations.length > 20) throw invalidOp("operation은 1~20개입니다.");
  const course = clone(original);
  const now = nowIso();
  const by = { userId: me.userId, nickname: me.nickname };

  for (const raw of operations as ScheduleOperation[]) {
    const op = raw as ScheduleOperation & Record<string, unknown>;
    if ("note" in op && op.note !== undefined && op.op !== "REMOVE" && op.op !== "REPLACE") throw invalidOp("사유는 교체·삭제에만 적어요.");
    if ("removalId" in op && op.op !== "RESTORE") throw invalidOp();
    switch (op.op) {
      case "ADD": {
        const dayIndex = checkDay(course, op.dayIndex);
        const a = checkNewAttraction(course, trip, op.attractionId);
        const items = course.days[dayIndex];
        const position = checkPosition(op.position, items.length);
        items.splice(position, 0, {
          itemId: `a-${++course.seq}`,
          type: "ATTRACTION",
          attractionId: a.attractionId,
          source: "MANUAL",
          reason: null,
          change: { origin: "ADDED", by, replacedFrom: null, note: null, changedAt: now },
        });
        course.latest = { type: "ADDED", dayIndex, attractionName: a.name, replacedFromName: null, by, note: null, at: now };
        break;
      }
      case "REPLACE": {
        const { dayIndex, item } = findItem(course, op.itemId);
        if (item.type !== "ATTRACTION") throw invalidOp("식사는 교체할 수 없어요.");
        const note = checkNote(op.note);
        const a = checkNewAttraction(course, trip, op.attractionId);
        const before = findAttraction(item.attractionId);
        // 처음 기준 장소는 여러 번 바꿔도 그대로 둡니다. 추가한 장소는 바꿔도 ADDED.
        const origin: ChangeOrigin = item.change.origin === "ADDED" ? "ADDED" : "REPLACED";
        const replacedFrom = item.change.origin === "BASE" ? { attractionId: item.attractionId, name: before?.name ?? "" } : item.change.replacedFrom;
        item.attractionId = a.attractionId;
        item.source = "MANUAL";
        item.reason = null;
        item.change = { origin, by, replacedFrom: origin === "REPLACED" ? replacedFrom : null, note, changedAt: now };
        course.latest = {
          type: "REPLACED",
          dayIndex,
          attractionName: a.name,
          replacedFromName: before?.name ?? null,
          by,
          note,
          at: now,
        };
        break;
      }
      case "MOVE": {
        const { dayIndex: from, index, item } = findItem(course, op.itemId);
        const to = checkDay(course, op.dayIndex);
        if (item.type === "MEAL" && to !== from) throw invalidOp("식사는 같은 날 안에서만 옮길 수 있어요.");
        if (op.position === undefined || op.position === null) throw invalidOp("위치를 정해 주세요.");
        course.days[from].splice(index, 1);
        const position = checkPosition(op.position, course.days[to].length);
        course.days[to].splice(position, 0, item);
        break;
      }
      case "REMOVE": {
        const { dayIndex, index, item } = findItem(course, op.itemId);
        if (item.type === "MEAL") {
          // 식사는 칸과 고른 식당을 함께 지우고 제외 기록에 남기지 않습니다. note는 받지 않습니다.
          if (op.note !== undefined) throw invalidOp("식사를 뺄 때는 사유를 적지 않아요.");
          course.days[dayIndex].splice(index, 1);
          break;
        }
        const note = checkNote(op.note);
        const a = findAttraction(item.attractionId);
        course.days[dayIndex].splice(index, 1);
        course.removals.push({
          removalId: ++course.seq,
          attractionId: item.attractionId,
          name: a?.name ?? "",
          dayIndex,
          origin: item.change.origin,
          removedBy: by,
          note,
          removedAt: now,
        });
        course.latest = { type: "REMOVED", dayIndex, attractionName: a?.name ?? "", replacedFromName: null, by, note, at: now };
        break;
      }
      case "RESTORE": {
        const removal = course.removals.find((r) => r.removalId === op.removalId);
        if (!removal) throw new MockError(404, "COURSE_REMOVAL_NOT_FOUND", "다시 넣을 수 없는 기록이에요.");
        const dayIndex = op.dayIndex === undefined ? removal.dayIndex : checkDay(course, op.dayIndex);
        const a = checkNewAttraction(course, trip, removal.attractionId);
        const items = course.days[dayIndex];
        const position = checkPosition(op.position, items.length);
        const origin: ChangeOrigin = removal.origin === "BASE" ? "BASE" : "ADDED";
        items.splice(position, 0, {
          itemId: `a-${++course.seq}`,
          type: "ATTRACTION",
          attractionId: a.attractionId,
          source: origin === "BASE" ? "RECOMMEND" : "MANUAL",
          reason: null,
          change: { origin, by, replacedFrom: null, note: null, changedAt: now },
        });
        course.removals = course.removals.filter((r) => r.removalId !== removal.removalId);
        course.latest = { type: "RESTORED", dayIndex, attractionName: a.name, replacedFromName: null, by, note: null, at: now };
        break;
      }
      case "SET_RESTAURANT": {
        const { item } = findItem(course, op.itemId);
        if (item.type !== "MEAL") throw invalidOp("식당은 식사에만 고를 수 있어요.");
        item.restaurant = readSelectionToken(op.selectionToken, trip.id, item.itemId);
        break;
      }
      case "CLEAR_RESTAURANT": {
        const { item } = findItem(course, op.itemId);
        if (item.type !== "MEAL") throw invalidOp("식당은 식사에만 고를 수 있어요.");
        item.restaurant = null;
        break;
      }
      case "ADD_MEAL": {
        const dayIndex = checkDay(course, op.dayIndex);
        if (op.meal !== "LUNCH" && op.meal !== "DINNER") throw invalidOp("끼니는 LUNCH·DINNER예요.");
        const items = course.days[dayIndex];
        if (items.some((i) => i.type === "MEAL" && i.meal === op.meal)) throw invalidOp("이미 있는 끼니예요.");
        const position = checkPosition(op.position, items.length);
        items.splice(position, 0, { itemId: `m-${++course.seq}`, type: "MEAL", meal: op.meal, restaurant: null });
        break;
      }
      default:
        throw invalidOp();
    }
  }
  course.updatedBy = by;
  course.updatedAt = now;
  return course;
}

// ── 식당 선택 토큰 (목업 형식: 서명 대신 내용을 그대로 담습니다) ──
const TOKEN_TTL_MS = 30 * 60 * 1000;
const issueSelectionToken = (tripId: number, itemId: string, snapshot: RestaurantSnapshot) =>
  `rs_${encodeURIComponent(JSON.stringify({ tripId, itemId, exp: Date.now() + TOKEN_TTL_MS, snapshot }))}`;
function readSelectionToken(tokenValue: unknown, tripId: number, itemId: string): RestaurantSnapshot {
  const invalid = new MockError(422, "COURSE_RESTAURANT_SELECTION_INVALID", "식당 선택이 만료됐어요. 다시 골라 주세요.");
  if (typeof tokenValue !== "string" || !tokenValue.startsWith("rs_")) throw invalid;
  try {
    const payload = JSON.parse(decodeURIComponent(tokenValue.slice(3))) as { tripId: number; itemId: string; exp: number; snapshot: RestaurantSnapshot };
    if (payload.tripId !== tripId || payload.itemId !== itemId || payload.exp < Date.now()) throw invalid;
    return payload.snapshot;
  } catch {
    throw invalid;
  }
}

function mealContext(trip: CourseTrip, course: MockCourse, itemId: string | null) {
  if (!itemId) throw new MockError(400, "COMMON_INVALID_REQUEST", "식사 항목을 정해 주세요.");
  const { dayIndex, index, item } = findItem(course, itemId);
  if (item.type !== "MEAL") throw invalidOp("식사 항목이 아니에요.");
  const prev = previousAttraction(course.days[dayIndex], index);
  const region = findRegion(trip.regionSigCd)!;
  const origin = prev
    ? { type: "PREVIOUS_ATTRACTION" as const, attractionId: prev.attractionId, lat: prev.lat, lng: prev.lng }
    : { type: "REGION_CENTER" as const, attractionId: null, lat: region.centerLat, lng: region.centerLng };
  return { item, origin };
}
const checkRadius = (radius: string | null) => {
  if (radius === null) return 5000;
  const r = Number(radius);
  if (!Number.isInteger(r) || r < 1 || r > 20000) throw new MockError(400, "COMMON_INVALID_REQUEST", "반경은 20km 이하로 정해 주세요.");
  return r;
};

/** 5-5 식당 추천 — MVP처럼 TourAPI 섹션만 채우고 나머지는 빈 배열 */
export function restaurantRecommendations(trip: CourseTrip, course: MockCourse, itemId: string | null, radiusParam: string | null): RestaurantRecommendations {
  const { item, origin } = mealContext(trip, course, itemId);
  const radius = checkRadius(radiusParam);
  const items: RestaurantCandidate[] = restaurantsFor(trip.regionSigCd!)
    .map((r) => ({ ...r, distanceMeters: distanceMeters(origin, r), selectionToken: issueSelectionToken(trip.id, item.itemId, r) }))
    .filter((r) => r.distanceMeters <= radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    // 서버처럼 추천 이유를 최대 2개 붙입니다 (동선·출처 근거만, 맛·평점 표현 없음)
    .map((r, i) => ({ ...r, reasons: [...(i < 2 ? [`앞 장소에서 ${r.distanceMeters < 1000 ? `${r.distanceMeters}m` : `${(r.distanceMeters / 1000).toFixed(1)}km`} 거리예요`] : []), "한국관광공사에 등록된 음식점이에요"] }))
    .slice(0, 20);
  return {
    itemId: item.itemId,
    origin,
    regionFoodThemes: [],
    sections: [
      { source: "TOUR_API", label: "한국관광공사 등록 음식점", items },
      { source: "FARM_RESTAURANT", label: "농촌진흥청 농가맛집", items: [] },
      { source: "MODEL_RESTAURANT", label: "지자체 모범·향토음식점", items: [] },
      { source: "GOOD_PRICE", label: "착한가격업소", items: [] },
    ],
  };
}

/** 5-6 식당 검색(카카오 자리) — 목업은 검색어로 이름을 만든 가짜 결과를 2쪽까지 줍니다 */
export function restaurantSearch(
  trip: CourseTrip,
  course: MockCourse,
  params: { itemId: string | null; query: string | null; radius: string | null; page: string | null },
): RestaurantSearch {
  const { item, origin } = mealContext(trip, course, params.itemId);
  checkRadius(params.radius);
  const query = params.query?.trim() ?? "";
  if (params.query !== null && (query.length < 1 || query.length > 50)) throw new MockError(400, "COMMON_INVALID_REQUEST", "검색어는 1~50자입니다.");
  const page = params.page === null ? 1 : Number(params.page);
  if (!Number.isInteger(page) || page < 1 || page > 45) throw new MockError(400, "COMMON_INVALID_REQUEST", "쪽 번호가 올바르지 않아요.");
  const region = findRegion(trip.regionSigCd)!;
  const label = query || "음식점";
  const items: RestaurantCandidate[] = Array.from({ length: page <= 2 ? 5 : 0 }, (_, i) => {
    const n = (page - 1) * 5 + i + 1;
    const lat = origin.lat + 0.002 * n;
    const lng = origin.lng - 0.0015 * n;
    const address = `${region.province} ${region.city}`;
    const snapshot: RestaurantSnapshot = {
      provider: "KAKAO",
      externalId: `kakao-mock-${trip.regionSigCd}-${label}-${n}`,
      name: `${label} ${n}호점`,
      category: "음식점",
      address,
      roadAddress: address,
      lat,
      lng,
      phone: null,
      placeUrl: null,
      imageUrl: null,
      representativeMenu: null,
      evidenceLabels: ["카카오맵 검색 결과"],
      sources: [],
    };
    return { ...snapshot, distanceMeters: distanceMeters(origin, snapshot), selectionToken: issueSelectionToken(trip.id, item.itemId, snapshot) };
  });
  return { itemId: item.itemId, origin, page, isEnd: page >= 2, items };
}

// ── 대체 후보 (5-4) ──
export function alternatives(
  trip: CourseTrip,
  course: MockCourse,
  params: { itemId: string | null; category: string | null; limit: string | null; q: string | null },
): Alternatives {
  const bad = (message: string) => new MockError(400, "COMMON_INVALID_REQUEST", message);
  if (params.category !== null && !CATEGORIES.includes(params.category as AttractionCategory)) throw bad("없는 유형이에요.");
  const limit = params.limit === null ? 10 : Number(params.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw bad("개수는 1~30입니다.");
  const q = params.q === null ? null : params.q.replace(/\s+/g, "");
  if (q !== null && (q.length < 1 || q.length > 50)) throw bad("검색어는 1~50자입니다.");

  let target: StoredAttraction | null = null;
  let prev: { lat: number; lng: number } | null = null;
  if (params.itemId) {
    const found = findItem(course, params.itemId);
    if (found.item.type !== "ATTRACTION") throw invalidOp("식사는 교체할 수 없어요.");
    target = found.item;
    prev = previousAttraction(course.days[found.dayIndex], found.index);
  }
  const targetCategory = target ? findAttraction(target.attractionId)?.category : undefined;
  const region = findRegion(trip.regionSigCd)!;
  const anchor = prev ?? (target ? findAttraction(target.attractionId)! : { lat: region.centerLat, lng: region.centerLng });

  const candidates = attractionsFor(trip.regionSigCd!)
    .filter((a) => !inCourse(course, a.attractionId))
    .filter((a) => (params.category ? a.category === params.category : true))
    .filter((a) => (q ? a.name.replace(/\s+/g, "").includes(q) : true));

  const groups = CATEGORIES.map((category) => {
    const items = candidates
      .filter((a) => a.category === category)
      .map((a) => ({ a, meters: distanceMeters(anchor, a) }))
      .sort((x, y) => x.meters - y.meters)
      .slice(0, limit)
      .map(({ a, meters }) => {
        const minutes = prev ? estimateMinutes(distanceMeters(prev, a), trip.transport) : null;
        const reasons = [
          ...(targetCategory === a.category ? [`바꾸려는 곳과 같은 ${CATEGORY_LABEL[a.category]} 장소예요`] : []),
          ...(minutes !== null ? [`앞 장소에서 약 ${minutes}분이에요`] : []),
        ].slice(0, 2);
        return {
          attractionId: a.attractionId,
          name: a.name,
          category: a.category,
          thumbnailUrl: null,
          lat: a.lat,
          lng: a.lng,
          estimatedDurationMinutes: a.durationMinutes,
          travelFromPreviousMinutes: minutes,
          reason: reasons.length ? reasons.join(" · ") : null,
        };
      });
    return { category, label: CATEGORY_LABEL[category], items };
  }).filter((g) => g.items.length > 0);
  return { itemId: target?.itemId ?? null, groups };
}

// ── 경로 (5-7) — 목업은 모든 구간이 직선 ──
export function routes(trip: CourseTrip, course: MockCourse, dayIndexParam: string | null, transportParam: string | null): CourseRoutes {
  const bad = () => new MockError(400, "COMMON_INVALID_REQUEST", "요청 값이 올바르지 않습니다.");
  const dayIndex = Number(dayIndexParam);
  if (dayIndexParam === null || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= course.days.length) throw bad();
  if (transportParam !== null && !["WALK", "CAR", "PUBLIC_TRANSIT"].includes(transportParam)) throw bad();
  const transport = (transportParam ?? trip.transport) as Transport;
  const points = course.days[dayIndex]
    .map((item) => {
      const p = item.type === "ATTRACTION" ? findAttraction(item.attractionId) : item.restaurant;
      return p ? { itemId: item.itemId, lat: p.lat, lng: p.lng } : null;
    })
    .filter((p): p is { itemId: string; lat: number; lng: number } => p !== null);
  const legs = points.slice(1).map((to, i) => {
    const from = points[i];
    const meters = distanceMeters(from, to);
    return {
      fromItemId: from.itemId,
      toItemId: to.itemId,
      source: "STRAIGHT" as const,
      distanceMeters: meters,
      durationMinutes: estimateMinutes(meters, transport),
      path: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ] as [number, number][],
      transfers: null,
      fare: null,
    };
  });
  return { tripId: trip.id, version: trip.version, dayIndex, transport, legs };
}

// ── 첫 장소 거리 (5-8) — 목업은 세 수단 모두 직선 추정, 도보는 10km 넘으면 null ──
export function firstLeg(trip: CourseTrip, course: MockCourse, dayIndexParam: string | null, latParam: string | null, lngParam: string | null): CourseFirstLeg {
  const bad = () => new MockError(400, "COMMON_INVALID_REQUEST", "요청 값이 올바르지 않습니다.");
  const dayIndex = dayIndexParam === null ? 0 : Number(dayIndexParam);
  const lat = Number(latParam);
  const lng = Number(lngParam);
  if (latParam === null || lngParam === null || !(lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132)) throw bad();
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= course.days.length) throw bad();
  const item = course.days[dayIndex].find((i) => i.type === "ATTRACTION");
  const a = item?.type === "ATTRACTION" ? findAttraction(item.attractionId) : undefined;
  if (!item || !a) throw bad();
  const meters = distanceMeters({ lat, lng }, a);
  const mode = (transport: Transport) => ({ source: "STRAIGHT" as const, distanceMeters: meters, durationMinutes: estimateMinutes(meters, transport), transfers: null, fare: null });
  return {
    tripId: trip.id,
    dayIndex,
    itemId: item.itemId,
    attractionId: a.attractionId,
    name: a.name,
    lat: a.lat,
    lng: a.lng,
    straightMeters: meters,
    car: mode("CAR"),
    walk: meters > 10_000 ? null : mode("WALK"),
    transit: mode("PUBLIC_TRANSIT"),
  };
}
