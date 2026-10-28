import type { AttractionPin, CourseDay } from "@/api/types";
import { parseMapMessage } from "@/features/kakaoMap/html";
import { attractionIdsInCourse, bboxOf, buildAddMarkers, pinKey } from "@/features/place/addPlace";

// 장소 추가 화면: 지도 범위 → 7-3 bbox, 그 날 코스 + 지역 관광지 핀.

describe("bboxOf", () => {
  it("보이는 범위를 minLng,minLat,maxLng,maxLat로 (소수 넷째 자리)", () => {
    expect(bboxOf({ minLat: 35.12345, minLng: 128.98765, maxLat: 35.2, maxLng: 129.1, level: 6 })).toBe("128.9877,35.1235,129.1,35.2");
  });

  it("한국 밖으로 넘친 부분은 잘라 내고, 남는 범위가 없으면 null", () => {
    expect(bboxOf({ minLat: 32, minLng: 123, maxLat: 34, maxLng: 127, level: 12 })).toBe("124,33,127,34");
    expect(bboxOf({ minLat: 40, minLng: 140, maxLat: 41, maxLng: 141, level: 5 })).toBeNull();
  });
});

describe("buildAddMarkers", () => {
  const day: CourseDay = {
    dayIndex: 0,
    date: "2026-11-20",
    items: [
      { type: "ATTRACTION", itemId: "a-1", attractionId: 1, name: "가", lat: 35.1, lng: 129.0 } as never,
      { type: "MEAL", itemId: "m-1", meal: "LUNCH", restaurant: null } as never,
      { type: "MEAL", itemId: "m-2", meal: "DINNER", restaurant: { lat: 35.2, lng: 129.1 } } as never,
    ],
  };
  const pins: AttractionPin[] = [
    { attractionId: 1, name: "가", thumbnailUrl: null, category: "NATURE", lat: 35.1, lng: 129.0, recommendable: true },
    { attractionId: 2, name: "나", thumbnailUrl: null, category: "NATURE", lat: 35.15, lng: 129.05, recommendable: true },
    { attractionId: 3, name: "다", thumbnailUrl: null, category: "ETC", lat: 35.16, lng: 129.06, recommendable: false },
  ];

  it("그 날 코스는 번호, 식당 미정 식사는 건너뛰고, 이미 코스에 있는 관광지는 핀에서 뺀다", () => {
    const markers = buildAddMarkers(day, pins, attractionIdsInCourse([day]), 3);
    expect(markers.filter((m) => m.kind === "course" || m.kind === "meal").map((m) => m.number)).toEqual([1, 2]);
    expect(markers.find((m) => m.id === pinKey(1))).toBeUndefined();
    expect(markers.find((m) => m.id === pinKey(2))?.kind).toBe("place");
    expect(markers.find((m) => m.id === pinKey(3))).toMatchObject({ kind: "placeOff", selected: true });
  });
});

describe("parseMapMessage bounds", () => {
  it("숫자가 모두 있으면 범위 메시지, 하나라도 빠지면 무시", () => {
    expect(parseMapMessage(JSON.stringify({ type: "bounds", minLat: 35, minLng: 129, maxLat: 35.2, maxLng: 129.2, level: 6 }))).toEqual({
      type: "bounds",
      minLat: 35,
      minLng: 129,
      maxLat: 35.2,
      maxLng: 129.2,
      level: 6,
    });
    expect(parseMapMessage(JSON.stringify({ type: "bounds", minLat: 35 }))).toBeNull();
  });
});
