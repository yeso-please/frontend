import type {
  AlternativeItem,
  Alternatives,
  AttractionCategory,
  AttractionItem,
  Course,
  CourseItem,
  MealItem,
  RestaurantRecommendations,
  RouteLeg,
} from "@/api/types";
import { formatDistance, formatMinutes, mealLabel } from "@/features/course/format";
import type { MapMarker, MapPolyline } from "@/features/kakaoMap/types";

// 장소 편집(F1)·식사·코스 지도 화면이 함께 쓰는 순수 함수. 화면 밖에서 단위 테스트합니다.
// 이동 시간·거리·카드 라벨 표기는 코스 화면과 같도록 @/features/course/format 을 씁니다.

export const CATEGORY_LABEL: Record<AttractionCategory, string> = {
  NATURE: "자연",
  HISTORY_CULTURE: "역사·문화",
  ACTIVITY: "체험·레포츠",
  WALK_REST: "산책·휴식",
  ETC: "기타",
};

/** 코스에서 항목 하나를 찾습니다 (몇째 날, 그날 몇 번째인지 함께) */
export function findCourseItem(course: Course | undefined, itemId: string) {
  if (!course) return null;
  for (const day of course.days) {
    const index = day.items.findIndex((i) => i.itemId === itemId);
    if (index >= 0) return { item: day.items[index], dayIndex: day.dayIndex, date: day.date, index };
  }
  return null;
}

export const isAttraction = (item: CourseItem | undefined | null): item is AttractionItem => item?.type === "ATTRACTION";
export const isMeal = (item: CourseItem | undefined | null): item is MealItem => item?.type === "MEAL";

/**
 * 대체 후보 10곳. 서버는 유형별로 점수 순 목록을 주므로, 지금 장소와 같은 유형부터 유형을 돌아가며 한 곳씩 뽑아
 * 여러 유형이 섞이게 합니다. 같은 관광지는 한 번만.
 */
export function pickTopAlternatives(data: Alternatives | undefined, currentCategory: AttractionCategory | null, limit = 10): AlternativeItem[] {
  if (!data) return [];
  const groups = [...data.groups].sort((a, b) => Number(b.category === currentCategory) - Number(a.category === currentCategory));
  const queues = groups.map((g) => [...g.items]);
  const seen = new Set<number>();
  const out: AlternativeItem[] = [];
  while (out.length < limit && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const next = q.shift();
      if (!next || seen.has(next.attractionId)) continue;
      seen.add(next.attractionId);
      out.push(next);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** 검색 결과는 유형 순서 그대로 펼칩니다 */
export function flattenAlternatives(data: Alternatives | undefined): AlternativeItem[] {
  if (!data) return [];
  const seen = new Set<number>();
  return data.groups.flatMap((g) => g.items).filter((i) => (seen.has(i.attractionId) ? false : (seen.add(i.attractionId), true)));
}

/** 장소 편집 지도: 지금 장소(초록 핀) + 후보 번호(파랑) */
export function buildCandidateMarkers(current: AttractionItem, candidates: AlternativeItem[], selectedId: number | null): MapMarker[] {
  return [
    { id: `current-${current.itemId}`, lat: current.lat, lng: current.lng, kind: "current" },
    ...candidates.map(
      (c, i): MapMarker => ({ id: `cand-${c.attractionId}`, lat: c.lat, lng: c.lng, kind: "candidate", number: i + 1, selected: c.attractionId === selectedId }),
    ),
  ];
}

export type RoutePoint = { itemId: string; name: string; lat: number; lng: number; kind: "course" | "meal" };

/** 지도에 올릴 수 있는 지점 = 관광지 + 식당을 고른 식사 (5-7 구간 규칙과 같음) */
export function routePoints(items: CourseItem[]): RoutePoint[] {
  return items.flatMap((item): RoutePoint[] => {
    if (item.type === "ATTRACTION") return [{ itemId: item.itemId, name: item.name, lat: item.lat, lng: item.lng, kind: "course" }];
    if (item.restaurant) return [{ itemId: item.itemId, name: `${mealLabel(item.meal)} · ${item.restaurant.name}`, lat: item.restaurant.lat, lng: item.restaurant.lng, kind: "meal" }];
    return [];
  });
}

/** 코스 지도 번호 핀 — 방문 순서대로 1부터 */
export function buildCourseMarkers(items: CourseItem[], selectedItemId: string | null = null): MapMarker[] {
  return routePoints(items).map((p, i) => ({ id: p.itemId, lat: p.lat, lng: p.lng, kind: p.kind, number: i + 1, selected: p.itemId === selectedItemId }));
}

/** 5-7 구간 → 지도 선. 직선 추정 구간은 점선 */
export function buildRouteLines(legs: RouteLeg[]): MapPolyline[] {
  return legs.map((leg) => ({ id: `${leg.fromItemId}>${leg.toItemId}`, path: leg.path, dashed: leg.source === "STRAIGHT", color: "green" }));
}

export const formatFare = (won: number) => `${won.toLocaleString("ko-KR")}원`;

/** 구간 한 줄 — "약 12분 · 1.8km" / 대중교통이면 "· 환승 1회 · 1,500원" */
export function legSummary(leg: RouteLeg): string {
  const parts = [`${leg.source === "STRAIGHT" ? "약 " : ""}${formatMinutes(leg.durationMinutes)}`, formatDistance(leg.distanceMeters)];
  if (leg.source === "TRANSIT") {
    if (leg.transfers != null) parts.push(leg.transfers === 0 ? "환승 없음" : `환승 ${leg.transfers}회`);
    if (leg.fare != null) parts.push(formatFare(leg.fare));
  }
  return parts.join(" · ");
}

/** 식당 추천 섹션 중 비지 않은 것만 (MVP는 관광공사 음식점만 채워짐) */
export function nonEmptySections(data: RestaurantRecommendations | undefined) {
  return (data?.sections ?? []).filter((s) => s.items.length > 0);
}

// 식당 분류 표시. 관광공사 음식점은 옛 서비스 분류 코드(A0502xxxx)나 새 분류(FD…)로, 카카오는 "음식점 > 한식 > 국수"로 옵니다.
const TOUR_FOOD_CODE: Record<string, string> = {
  A05020100: "한식",
  A05020200: "서양식",
  A05020300: "일식",
  A05020400: "중식",
  A05020600: "패밀리 레스토랑",
  A05020700: "이색 음식점",
  A05020800: "채식 전문점",
  A05020900: "카페·찻집",
  A05021000: "클럽",
};
// 신분류체계(lclsSystm) 음식 — 관광공사 "신분류체계정보 관광타입정보 연계 정의서"
const FD_CODE: Record<string, string> = {
  FD01: "한식",
  FD010100: "한식",
  FD010200: "모범음식점",
  FD02: "외국식",
  FD020100: "중식",
  FD020200: "일식",
  FD020300: "서양식",
  FD020400: "외국식",
  FD020500: "퓨전 음식",
  FD03: "간이음식",
  FD030100: "제과",
  FD030200: "피자·햄버거",
  FD030300: "치킨",
  FD030400: "김밥·분식",
  FD030500: "이동 음식",
  FD030600: "간이음식",
  FD04: "주점",
  FD040100: "바·펍",
  FD040200: "생맥주",
  FD040300: "클럽",
  FD040400: "전통주점",
  FD040500: "주점",
  FD05: "카페·찻집",
  FD050100: "카페",
  FD050200: "찻집",
};

/** 식당 분류를 사람이 읽는 말로. 알 수 없는 코드는 숨깁니다(null) */
export function restaurantCategoryLabel(category: string | null | undefined): string | null {
  const c = category?.trim();
  if (!c) return null;
  if (c.includes(">")) {
    const parts = c.split(">").map((p) => p.trim()).filter(Boolean);
    const rest = parts[0] === "음식점" ? parts.slice(1) : parts;
    return rest.slice(-2).join(" · ") || null;
  }
  if (TOUR_FOOD_CODE[c]) return TOUR_FOOD_CODE[c];
  if (FD_CODE[c]) return FD_CODE[c];
  if (/^[A-Z]{1,2}\d{2,}$/.test(c)) return null;
  return c;
}

