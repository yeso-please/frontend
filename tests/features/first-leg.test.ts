// 코스 첫 장소 거리(5-8) 한 줄 문구 — 요청서 #6 표시 예시와 같은지 확인합니다.
import type { CourseFirstLeg } from "@/api/types";
import { firstLegParts } from "@/features/course/format";

const base: CourseFirstLeg = {
  tripId: 42,
  dayIndex: 0,
  itemId: "a-101",
  attractionId: 5012,
  name: "대릉원",
  lat: 35.838,
  lng: 129.211,
  straightMeters: 2400,
  car: { source: "ROAD", distanceMeters: 3100, durationMinutes: 9, transfers: null, fare: null },
  walk: { source: "WALK", distanceMeters: 2700, durationMinutes: 38, transfers: null, fare: null },
  transit: { source: "TRANSIT", distanceMeters: 2900, durationMinutes: 21, transfers: 0, fare: 1500 },
};

describe("첫 장소 거리 문구", () => {
  it("자동차는 시간·거리, 도보는 시간, 대중교통은 환승·요금을 붙입니다", () => {
    expect(firstLegParts(base).map((p) => p.text)).toEqual(["🚗 9분 3.1km", "🚶 38분", "🚌 21분(환승 0, 1,500원)"]);
  });

  it("직선 추정은 '약 N분(직선 추정)', 도보가 없으면(10km 초과) 뺍니다", () => {
    const parts = firstLegParts({
      ...base,
      walk: null,
      transit: { source: "STRAIGHT", distanceMeters: 12000, durationMinutes: 75, transfers: null, fare: null },
    });
    expect(parts.map((p) => p.text)).toEqual(["🚗 9분 3.1km", "🚌 약 1시간 15분(직선 추정)"]);
  });
});
