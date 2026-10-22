import type { AlternativeItem, Alternatives, AttractionItem, CourseItem, RouteLeg } from "@/api/types";
// 지도 컴포넌트(웹뷰·Reanimated)를 끌어오지 않도록 순수 모듈만 직접 가져옵니다
import { buildMapHtml, parseMapMessage, sanitizeAppKey, toJsStringLiteral, toRenderScript } from "@/features/kakaoMap/html";
import { boundsOf, kakaoMapLink } from "@/features/kakaoMap/links";
import { buildCandidateMarkers, buildCourseMarkers, buildRouteLines, legSummary, pickTopAlternatives, restaurantCategoryLabel } from "@/features/place/lib";

const attraction = (id: number, over: Partial<AttractionItem> = {}): AttractionItem => ({
  itemId: `a-${id}`,
  type: "ATTRACTION",
  attractionId: id,
  name: `장소${id}`,
  category: "NATURE",
  thumbnailUrl: null,
  address: null,
  lat: 37 + id / 100,
  lng: 128 + id / 100,
  durationMinutes: 90,
  travelFromPreviousMinutes: null,
  travelFromPreviousMeters: null,
  travelFromPrevious: null,
  estimated: true,
  source: "RECOMMEND",
  reason: null,
  reasonSource: null,
  personalReason: null,
  oneLine: null,
  summaryBasis: null,
  change: { origin: "BASE", by: null, replacedFrom: null, note: null, changedAt: null },
  ...over,
});

const alt = (id: number, category: AlternativeItem["category"]): AlternativeItem => ({
  attractionId: id,
  name: `후보${id}`,
  category,
  thumbnailUrl: null,
  lat: 37,
  lng: 128,
  estimatedDurationMinutes: 60,
  travelFromPreviousMinutes: 10,
  reason: null,
});

describe("카카오맵 웹뷰 페이지", () => {
  it("앱 키는 영숫자만 받고, 이상한 키면 SDK를 부르지 않습니다", () => {
    expect(sanitizeAppKey(" 0123456789abcdef0123456789abcdef ")).toBe("0123456789abcdef0123456789abcdef");
    expect(sanitizeAppKey('abc"><script>')).toBe("");
    expect(buildMapHtml("abcdef123456")).toContain("sdk.js?appkey=abcdef123456&autoload=false");
    const noKey = buildMapHtml("");
    expect(noKey).not.toContain("dapi.kakao.com");
    expect(noKey).toContain("__tripinFail('sdk')");
  });

  it("이름에 </script>나 줄 구분자가 있어도 스크립트를 깨지 않습니다", () => {
    const literal = toJsStringLiteral('</script><img src=x onerror=alert(1)>\u2028끝');
    expect(literal).not.toMatch(/<|>|\u2028/);
    // 리터럴을 다시 해석하면 원래 문자열이 됩니다
    expect(JSON.parse(literal)).toBe('</script><img src=x onerror=alert(1)>\u2028끝');
    const script = toRenderScript({ markers: [{ id: "x", lat: 1, lng: 2, kind: "course", label: "</script>" }], polylines: [], fit: true, focusId: null });
    expect(script).not.toContain("</script>");
    expect(script.endsWith("true;")).toBe(true);
  });

  it("웹뷰 메시지는 아는 모양만 받습니다", () => {
    expect(parseMapMessage('{"type":"ready"}')).toEqual({ type: "ready" });
    expect(parseMapMessage('{"type":"markerPress","id":"cand-3"}')).toEqual({ type: "markerPress", id: "cand-3" });
    expect(parseMapMessage('{"type":"error","reason":"sdk"}')).toEqual({ type: "error", reason: "sdk" });
    expect(parseMapMessage('{"type":"markerPress","id":3}')).toBeNull();
    expect(parseMapMessage("not json")).toBeNull();
  });

  it("카카오맵 링크는 이름의 쉼표를 지우고 인코딩합니다", () => {
    expect(kakaoMapLink("안목해변, 강릉", 37.7718, 128.9473)).toBe(`https://map.kakao.com/link/map/${encodeURIComponent("안목해변 강릉")},37.7718,128.9473`);
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ lat: 1, lng: 5 }, { lat: 3, lng: 2 }])).toEqual({ minLat: 1, maxLat: 3, minLng: 2, maxLng: 5 });
  });
});

describe("장소 편집 후보", () => {
  const data: Alternatives = {
    itemId: "a-1",
    groups: [
      { category: "HISTORY_CULTURE", label: "역사·문화", items: [alt(11, "HISTORY_CULTURE"), alt(12, "HISTORY_CULTURE"), alt(13, "HISTORY_CULTURE")] },
      { category: "NATURE", label: "자연", items: [alt(21, "NATURE"), alt(22, "NATURE")] },
    ],
  };

  it("지금 장소와 같은 유형부터 유형을 번갈아 10곳까지 고릅니다", () => {
    expect(pickTopAlternatives(data, "NATURE").map((a) => a.attractionId)).toEqual([21, 11, 22, 12, 13]);
    expect(pickTopAlternatives(data, "NATURE", 3).map((a) => a.attractionId)).toEqual([21, 11, 22]);
    expect(pickTopAlternatives(undefined, null)).toEqual([]);
  });

  it("지도에는 지금 장소 핀 하나와 번호 붙은 후보가 올라갑니다", () => {
    const markers = buildCandidateMarkers(attraction(1), pickTopAlternatives(data, "NATURE", 2), 11);
    expect(markers.map((m) => [m.kind, m.number, m.selected])).toEqual([
      ["current", undefined, undefined],
      ["candidate", 1, false],
      ["candidate", 2, true],
    ]);
  });

  it("후보를 고르면 그 핀만 강조됩니다", () => {
    const markers = buildCandidateMarkers(attraction(1, { source: "MANUAL" }), [], null);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ kind: "current", lat: 37.01, lng: 128.01 });
  });
});

describe("코스 지도", () => {
  const items: CourseItem[] = [
    attraction(1),
    { itemId: "m-1", type: "MEAL", meal: "LUNCH", durationMinutes: 60, travelFromPreviousMinutes: null, travelFromPreviousMeters: null, travelFromPrevious: null, restaurant: null },
    attraction(2),
    {
      itemId: "m-2",
      type: "MEAL",
      meal: "DINNER",
      durationMinutes: 60,
      travelFromPreviousMinutes: 5,
      travelFromPreviousMeters: 400,
      travelFromPrevious: null,
      restaurant: {
        provider: "TOUR_API",
        externalId: "1",
        name: "순두부",
        category: "한식",
        address: null,
        roadAddress: null,
        lat: 37.5,
        lng: 128.5,
        phone: null,
        placeUrl: null,
        imageUrl: null,
        representativeMenu: null,
        evidenceLabels: [],
        sources: [],
      },
    },
  ];

  it("식당 미정 식사는 건너뛰고 방문 순서대로 번호를 붙입니다", () => {
    expect(buildCourseMarkers(items, "a-2").map((m) => [m.id, m.kind, m.number, m.selected])).toEqual([
      ["a-1", "course", 1, false],
      ["a-2", "course", 2, true],
      ["m-2", "meal", 3, false],
    ]);
  });

  it("직선 추정 구간은 점선, 대중교통은 환승·요금을 보여 줍니다", () => {
    const legs: RouteLeg[] = [
      { fromItemId: "a-1", toItemId: "a-2", source: "TRANSIT", distanceMeters: 2400, durationMinutes: 18, path: [[1, 2], [3, 4]], transfers: 1, fare: 1500 },
      { fromItemId: "a-2", toItemId: "m-2", source: "STRAIGHT", distanceMeters: 650, durationMinutes: 5, path: [[3, 4], [5, 6]], transfers: null, fare: null },
    ];
    expect(buildRouteLines(legs).map((l) => l.dashed)).toEqual([false, true]);
    expect(legSummary(legs[0])).toBe("18분 · 2.4km · 환승 1회 · 1,500원");
    expect(legSummary(legs[1])).toBe("약 5분 · 650m");
  });

});

describe("식당 분류 표시", () => {
  it("관광공사 코드·신분류·카카오 분류를 사람이 읽는 말로 바꾸고, 모르는 코드는 숨깁니다", () => {
    expect(restaurantCategoryLabel("A05020100")).toBe("한식");
    expect(restaurantCategoryLabel("FD050100")).toBe("카페");
    expect(restaurantCategoryLabel("음식점 > 한식 > 국수")).toBe("한식 · 국수");
    expect(restaurantCategoryLabel("A05029999")).toBeNull();
    expect(restaurantCategoryLabel("한식")).toBe("한식");
    expect(restaurantCategoryLabel(null)).toBeNull();
  });
});

