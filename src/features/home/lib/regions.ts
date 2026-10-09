import type { Region } from "@/api/types";
import { shortRegionName } from "@/lib/josa";
import { projectToMap } from "@/lib/mapProjection";

/** 지도에 꽂을 수 있게 표시 이름과 지도 좌표(0~1)를 붙인 지역 */
export type MapRegion = Region & {
  /** "강릉", "부산 해운대구" */
  name: string;
  u: number;
  v: number;
};

export type MapPoint = { u: number; v: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// 투영이 대략값(±5%)이라 울릉군처럼 그림 밖으로 나가는 지역은 가장자리 안쪽으로 붙입니다.
export function toMapRegion(region: Region): MapRegion {
  const p = projectToMap(region.centerLat, region.centerLng);
  return {
    ...region,
    name: shortRegionName(region.province, region.city),
    u: clamp(p.x, 0.05, 0.95),
    v: clamp(p.y, 0.04, 0.96),
  };
}

export const pickRandom = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

const distance = (a: MapPoint, b: MapPoint) => Math.hypot(a.u - b.u, (a.v - b.v) * 1.25);

/**
 * 핀이 "찾는 중"에 들르는 자리. 직전 자리와 충분히 떨어진(지도 폭의 약 18%) 추첨 가능 지역을 고르고,
 * 마지막 자리는 최종 지역과도 떨어뜨려 마지막 이동이 눈에 띄게 합니다.
 */
export function pickHopSpots(pool: readonly MapRegion[], from: MapPoint | null, target: MapPoint, count: number): MapPoint[] {
  const spots: MapPoint[] = [];
  let prev = from;
  for (let i = 0; i < count; i++) {
    let spot: MapPoint = pickRandom(pool);
    for (let tries = 0; tries < 16; tries++) {
      const candidate = pickRandom(pool);
      const farFromPrev = !prev || distance(candidate, prev) > 0.18;
      const farFromTarget = i < count - 1 || distance(candidate, target) > 0.2;
      if (farFromPrev && farFromTarget) {
        spot = candidate;
        break;
      }
    }
    spots.push({ u: spot.u, v: spot.v });
    prev = spot;
  }
  return spots;
}

/** 검색용: 공백을 지우고 소문자로 */
export const normalizeQuery = (text: string) => text.replace(/\s+/g, "").toLowerCase();
