import type { AttractionCategory, AttractionPin, CourseDay } from "@/api/types";
import type { MapBounds, MapMarker } from "@/features/kakaoMap";

// 장소 추가 화면 — 지도 관광지 핀(7-3)과 그 날 코스를 한 지도에 그립니다.

/** 7-3 bbox 허용 범위 (위도 33~39, 경도 124~132) */
const KOREA = { minLat: 33, maxLat: 39, minLng: 124, maxLng: 132 };
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** 지도에 보이는 범위 → 7-3 bbox "minLng,minLat,maxLng,maxLat". 한국 밖으로 넘친 부분은 잘라 내고, 남는 범위가 없으면 null */
export function bboxOf(b: MapBounds): string | null {
  const minLat = Math.max(KOREA.minLat, b.minLat);
  const maxLat = Math.min(KOREA.maxLat, b.maxLat);
  const minLng = Math.max(KOREA.minLng, b.minLng);
  const maxLng = Math.min(KOREA.maxLng, b.maxLng);
  if (!(minLat < maxLat && minLng < maxLng)) return null;
  return [round4(minLng), round4(minLat), round4(maxLng), round4(maxLat)].join(",");
}

export const pinKey = (attractionId: number) => `pin-${attractionId}`;
export const courseKey = (itemId: string) => `course-${itemId}`;

/** 지금 코스 전체(모든 날)에 있는 관광지 — 이미 있는 장소는 핀에서 뺍니다 (5-3 ATTRACTION_ALREADY_IN_COURSE) */
export function attractionIdsInCourse(days: CourseDay[]): Set<number> {
  const ids = new Set<number>();
  for (const day of days) for (const item of day.items) if (item.type === "ATTRACTION") ids.add(item.attractionId);
  return ids;
}

/**
 * 지도 점: 그 날 코스(초록·민트 번호) + 지역 관광지 핀(파란 원, 코스에 못 넣는 곳은 흐린 회색).
 * 고른 핀은 강조합니다.
 */
export function buildAddMarkers(day: CourseDay | undefined, pins: AttractionPin[], inCourse: Set<number>, selectedId: number | null): MapMarker[] {
  const markers: MapMarker[] = [];
  let n = 0;
  for (const item of day?.items ?? []) {
    if (item.type === "ATTRACTION") {
      n += 1;
      markers.push({ id: courseKey(item.itemId), lat: item.lat, lng: item.lng, kind: "course", number: n });
    } else if (item.restaurant) {
      n += 1;
      markers.push({ id: courseKey(item.itemId), lat: item.restaurant.lat, lng: item.restaurant.lng, kind: "meal", number: n });
    }
  }
  for (const pin of pins) {
    if (inCourse.has(pin.attractionId)) continue;
    markers.push({ id: pinKey(pin.attractionId), lat: pin.lat, lng: pin.lng, kind: pin.recommendable ? "place" : "placeOff", selected: pin.attractionId === selectedId });
  }
  return markers;
}

/** 고른 장소 — 지도 핀이나 추천 목록에서 */
export type PickedPlace = { attractionId: number; name: string; category: AttractionCategory; recommendable: boolean; reason: string | null };
