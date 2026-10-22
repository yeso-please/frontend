// 목업 지역·관광지·식당 데이터. 관광지·식당은 번들을 키우지 않도록 지역 코드로 그때그때 만들어 냅니다.
// 이름은 "{시군구} 숲길"처럼 일부러 일반적인 목업 이름이고, 실제 장소 정보가 아닙니다.
import { shortRegionName } from "@/lib/josa";

import type { AttractionCategory, Region, RestaurantSnapshot, ScheduleDensity, Transport, TravelLeg } from "../types";
import regionsData from "./regions.json";

export type BaseRegion = Omit<Region, "drawEligible" | "ineligibleReasons">;
export const BASE_REGIONS = regionsData as BaseRegion[];
const REGION_BY_CODE = new Map(BASE_REGIONS.map((r) => [r.sigCd, r]));
export const findRegion = (sigCd: string | null | undefined) => (sigCd ? REGION_BY_CODE.get(sigCd) : undefined);
export const regionName = (sigCd: string | null) => {
  const r = findRegion(sigCd);
  return r ? `${r.province} ${r.city}` : null;
};
export const regionShortName = (r: BaseRegion) => shortRegionName(r.province, r.city);

// ── 추첨 가능 여부 ──
// 실제 개발 RDS의 일수별 추첨 가능 지역 수(1일 242 … 7일 23, 2026-10-01 런북)를 비슷하게 흉내 냅니다.
const ELIGIBLE_RATIO: Record<number, number> = { 1: 0.97, 2: 0.82, 3: 0.31, 4: 0.19, 5: 0.16, 6: 0.12, 7: 0.09 };
const hash = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
};
const score = (sigCd: string) => (hash(sigCd) % 1000) / 1000;
/** 시연용 대표 지역은 긴 여행에도 뽑힙니다 (강릉·경주·부산 해운대·제주·여수·전주 완산) */
export const SHOWCASE = new Set(["51150", "47130", "26350", "50110", "46130", "52111"]);
export const isEligible = (sigCd: string, days: number, density: ScheduleDensity) => {
  if (SHOWCASE.has(sigCd)) return true;
  const ratio = ELIGIBLE_RATIO[Math.min(7, Math.max(1, days))] * (density === "PACKED" ? 0.7 : 1);
  return score(sigCd) < ratio;
};
/** 이 지역·밀도로 코스를 만들 수 있는 최대 박수(0~6). 하루도 안 되면 -1 */
export const maxNightsFor = (sigCd: string, density: ScheduleDensity) => {
  let max = -1;
  for (let days = 1; days <= 7; days += 1) if (isEligible(sigCd, days, density)) max = days - 1;
  return max;
};

// ── 결정적 난수 (지역마다 늘 같은 목업 데이터) ──
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CATEGORY_LABEL: Record<AttractionCategory, string> = {
  NATURE: "자연",
  HISTORY_CULTURE: "역사·문화",
  ACTIVITY: "체험·레포츠",
  WALK_REST: "산책·휴식",
  ETC: "기타",
};
const DURATION: Record<AttractionCategory, number> = { NATURE: 90, HISTORY_CULTURE: 90, ACTIVITY: 120, WALK_REST: 60, ETC: 60 };
const SUFFIX: Record<AttractionCategory, string[]> = {
  NATURE: ["숲길", "호수공원", "전망 언덕", "계곡", "수목원", "해안 산책로"],
  HISTORY_CULTURE: ["향교", "역사관", "미술관", "한옥마을", "고택", "옛 관아터"],
  ACTIVITY: ["레일바이크", "체험마을", "카약 체험장", "공방 거리", "짚라인"],
  WALK_REST: ["둘레길", "강변 쉼터", "꽃길 공원", "책방 골목", "카페 거리"],
  ETC: ["전통시장", "문화의 거리"],
};
const ONE_LINE: Record<AttractionCategory, string> = {
  NATURE: "천천히 걸으며 풍경을 담기 좋은 곳",
  HISTORY_CULTURE: "옛 이야기를 따라 둘러보기 좋은 곳",
  ACTIVITY: "몸을 움직이며 색다른 하루를 보내는 곳",
  WALK_REST: "잠시 쉬어 가며 여유를 즐기는 곳",
  ETC: "지역의 일상을 가까이에서 만나는 곳",
};
const CATEGORY_ORDER: AttractionCategory[] = ["NATURE", "HISTORY_CULTURE", "WALK_REST", "ACTIVITY", "NATURE", "HISTORY_CULTURE", "WALK_REST", "ETC"];

export type MockAttraction = {
  attractionId: number;
  sigCd: string;
  name: string;
  category: AttractionCategory;
  address: string;
  lat: number;
  lng: number;
  durationMinutes: number;
  oneLine: string;
};

const attractionCache = new Map<string, MockAttraction[]>();
/** 지역의 목업 관광지. 개수는 추첨 가능 일수에 맞춥니다(느슨하게 기준 하루 4곳). */
export function attractionsFor(sigCd: string): MockAttraction[] {
  const cached = attractionCache.get(sigCd);
  if (cached) return cached;
  const region = findRegion(sigCd);
  if (!region) return [];
  const days = maxNightsFor(sigCd, "RELAXED") + 1;
  const count = days > 0 ? Math.min(40, days * 4 + 3) : 2;
  const rand = seeded(hash(sigCd) * 7919 + 17);
  const short = regionShortName(region);
  // 유형마다 이름 목록의 시작 위치만 지역별로 달리하고, 한 바퀴 돌면 번호를 붙여 이름이 겹치지 않게 합니다.
  const offset = Object.fromEntries(Object.entries(SUFFIX).map(([c, s]) => [c, Math.floor(rand() * s.length)])) as Record<AttractionCategory, number>;
  const seen: Partial<Record<AttractionCategory, number>> = {};
  const list: MockAttraction[] = [];
  for (let i = 0; i < count; i += 1) {
    const category = CATEGORY_ORDER[i % CATEGORY_ORDER.length];
    const suffixes = SUFFIX[category];
    const k = seen[category] ?? 0;
    seen[category] = k + 1;
    const round = Math.floor(k / suffixes.length);
    const name = `${short} ${suffixes[(offset[category] + k) % suffixes.length]}${round > 0 ? ` ${round + 1}` : ""}`;
    list.push({
      attractionId: Number(sigCd) * 100 + i,
      sigCd,
      name,
      category,
      address: `${region.province} ${region.city}`,
      lat: round6(region.centerLat + (rand() - 0.5) * 0.12),
      lng: round6(region.centerLng + (rand() - 0.5) * 0.12),
      durationMinutes: DURATION[category],
      oneLine: ONE_LINE[category],
    });
  }
  attractionCache.set(sigCd, list);
  return list;
}

/** 관광지 id로 찾기 — id 앞자리가 지역 코드입니다 */
export const findAttraction = (attractionId: number): MockAttraction | undefined => {
  const sigCd = String(Math.floor(attractionId / 100));
  return attractionsFor(sigCd).find((a) => a.attractionId === attractionId);
};

const RESTAURANT_KINDS: [string, string][] = [
  ["국밥집", "한식"],
  ["칼국수", "한식 > 국수"],
  ["한정식", "한식"],
  ["분식", "분식"],
  ["해물집", "한식 > 해물"],
  ["막국수", "한식 > 국수"],
  ["백반집", "한식"],
  ["식당", "한식"],
];
const restaurantCache = new Map<string, RestaurantSnapshot[]>();
/** 지역의 목업 음식점 (TourAPI 음식점 자리) */
export function restaurantsFor(sigCd: string): RestaurantSnapshot[] {
  const cached = restaurantCache.get(sigCd);
  if (cached) return cached;
  const region = findRegion(sigCd);
  if (!region) return [];
  const rand = seeded(hash(sigCd) * 104729 + 3);
  const short = regionShortName(region);
  const list = RESTAURANT_KINDS.map(([kind, category], i): RestaurantSnapshot => {
    const address = `${region.province} ${region.city}`;
    return {
      provider: "TOUR_API",
      externalId: `mock-${sigCd}-${i}`,
      name: `${short} ${kind}`,
      category,
      address,
      roadAddress: address,
      lat: round6(region.centerLat + (rand() - 0.5) * 0.08),
      lng: round6(region.centerLng + (rand() - 0.5) * 0.08),
      phone: null,
      placeUrl: null,
      imageUrl: null,
      representativeMenu: null,
      evidenceLabels: ["한국관광공사 등록 음식점"],
      sources: [{ name: "한국관광공사 TourAPI", url: null }],
    };
  });
  restaurantCache.set(sigCd, list);
  return list;
}

// ── 거리·이동 시간 (백엔드 5장 직선 추정 규칙) ──
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
/** 직선거리 × 보정계수 / 속도, 최소 5분 (도보 1.25·4km/h, 자동차 1.35·35km/h, 대중교통 1.50·25km/h) */
const RULE: Record<Transport, [number, number]> = { WALK: [1.25, 4], CAR: [1.35, 35], PUBLIC_TRANSIT: [1.5, 25] };
export const estimateMinutes = (meters: number, transport: Transport) => {
  const [factor, kmh] = RULE[transport];
  return Math.max(5, Math.round(((meters / 1000) * factor * 60) / kmh));
};
export function straightLeg(meters: number): TravelLeg {
  return {
    meters,
    walkMinutes: estimateMinutes(meters, "WALK"),
    carMinutes: estimateMinutes(meters, "CAR"),
    transitMinutes: estimateMinutes(meters, "PUBLIC_TRANSIT"),
    carSource: "STRAIGHT",
    walkSource: "STRAIGHT",
    transitSource: "STRAIGHT",
    transitTransfers: null,
    transitFare: null,
    estimated: true,
  };
}
