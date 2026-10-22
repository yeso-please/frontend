import type { DrawResult, Region, RegionSelection } from "@/api/types";
import { shortRegionName } from "@/lib/josa";
import { projectToMap } from "@/lib/mapProjection";

export type MapPoint = { u: number; v: number };

/** 지도에 꽂을 수 있게 표시 이름과 지도 좌표(0~1)를 붙인 지역 */
export type MapRegion = MapPoint & {
  sigCd: string;
  province: string;
  city: string;
  /** 지역 중심 좌표 (여행 만들기에 그대로 넘깁니다) */
  lat: number;
  lng: number;
  /** "강릉", "부산 해운대구" */
  name: string;
};

/** 뽑힌(또는 직접 고른) 여행지. B4와 여행 만들기에 넘길 추첨 정보를 함께 둡니다. */
export type DiscoveredRegion = MapRegion & {
  selection: RegionSelection;
  /** 7-5의 최대 박수. 직접 고른 지역은 모르므로 null */
  maxNights: number | null;
};

const toMap = (base: Omit<MapRegion, "u" | "v" | "name">): MapRegion => {
  const p = projectToMap(base.lat, base.lng);
  return { ...base, name: shortRegionName(base.province, base.city), u: p.x, v: p.y };
};

export const toMapRegion = (region: Region): MapRegion =>
  toMap({ sigCd: region.sigCd, province: region.province, city: region.city, lat: region.centerLat, lng: region.centerLng });

export const fromDraw = (draw: DrawResult): DiscoveredRegion => ({
  ...toMap({ sigCd: draw.sigCd, province: draw.province, city: draw.city, lat: draw.lat, lng: draw.lng }),
  selection: draw.regionSelection,
  maxNights: draw.maxNights,
});

export const asManual = (region: MapRegion): DiscoveredRegion => ({ ...region, selection: "MANUAL", maxNights: null });

export const pickRandom = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

const distance = (a: MapPoint, b: MapPoint) => Math.hypot(a.u - b.u, (a.v - b.v) * 1.2);

// 지역 목록을 아직 못 받았을 때 핀이 들를 자리 (본토 곳곳)
const FALLBACK_SPOTS: MapPoint[] = [
  { u: 0.36, v: 0.23 },
  { u: 0.72, v: 0.3 },
  { u: 0.5, v: 0.5 },
  { u: 0.3, v: 0.62 },
  { u: 0.78, v: 0.66 },
  { u: 0.45, v: 0.75 },
];

/**
 * 핀이 "찾는 중"에 들르는 자리. 직전 자리와 충분히 떨어진(지도 폭의 약 18%) 자리를 고릅니다.
 * 서버가 아직 결과를 주지 않았으면 같은 방법으로 몇 자리 더 들릅니다.
 */
export function pickHopSpots(pool: readonly MapPoint[], from: MapPoint | null, count: number): MapPoint[] {
  const source = pool.length >= 4 ? pool : FALLBACK_SPOTS;
  const spots: MapPoint[] = [];
  let prev = from;
  for (let i = 0; i < count; i++) {
    let spot: MapPoint = pickRandom(source);
    for (let tries = 0; tries < 16; tries++) {
      const candidate = pickRandom(source);
      if (!prev || distance(candidate, prev) > 0.18) {
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
