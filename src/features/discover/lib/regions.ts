import type { DrawResult, Region, RegionSelection } from "@/api/types";
import { shortRegionName } from "@/lib/josa";
import { projectToMap } from "@/lib/mapProjection";

import { regionShape } from "./koreaMap";

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

/** 지도 위 핀 자리: 그림에 맞춘 시군구 경계 안의 점 (경계 데이터에 없는 코드는 위경도 변환으로) */
const toMap = (base: Omit<MapRegion, "u" | "v" | "name">): MapRegion => {
  const shape = regionShape(base.sigCd);
  const p = shape ? { x: shape.u, y: shape.v } : projectToMap(base.lat, base.lng);
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

/** 검색용: 공백을 지우고 소문자로 */
export const normalizeQuery = (text: string) => text.replace(/\s+/g, "").toLowerCase();
