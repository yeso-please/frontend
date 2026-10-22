import regions from "@/api/mock/regions.json";
import { buildMonthGrid, expandRanges, inclusiveDays, nextSaturday, rangeHitsBlocked, shiftMonth } from "@/features/trip/lib";
import { MAP_IMAGE, projectToMap } from "@/lib/mapProjection";

describe("mapProjection", () => {
  // 3D 지형 지도(1134×1368)에서 눈으로 찍은 위치 — 그림이 단순화돼 있어 이미지 크기의 10% 안이면 통과
  const landmarks: [string, number, number, number, number][] = [
    ["강릉 (피그마 B3 핀)", 37.75, 128.88, 833, 373],
    ["부산 (남동쪽 끝)", 35.1, 129.05, 870, 1000],
    ["호미곶 (동쪽 끝)", 36.08, 129.57, 1040, 755],
    ["태안 (서쪽 끝)", 36.75, 126.15, 210, 530],
    ["해남 땅끝 (남서쪽 끝)", 34.3, 126.53, 290, 1090],
    ["한라산 (제주 섬 가운데)", 33.36, 126.53, 325, 1235],
  ];

  it.each(landmarks)("%s 근처에 핀이 놓입니다", (_name, lat, lng, x, y) => {
    const p = projectToMap(lat, lng);
    expect(Math.abs(p.x - x / MAP_IMAGE.width)).toBeLessThan(0.1);
    expect(Math.abs(p.y - y / MAP_IMAGE.height)).toBeLessThan(0.1);
  });

  it("전국 250개 시군구 중심이 모두 지도 그림 안에 들어갑니다 (옹진군·울릉군은 가장자리로 보정)", () => {
    const outside = (regions as { sigCd: string; city: string; centerLat: number; centerLng: number }[]).filter((r) => {
      const p = projectToMap(r.centerLat, r.centerLng);
      return p.x < 0.05 || p.x > 0.95 || p.y < 0.05 || p.y > 0.96;
    });
    expect(outside.map((r) => r.city)).toEqual([]);
  });

  it("제주 두 시는 그림 속 제주 섬 위에 놓입니다", () => {
    const jeju = (regions as { sigCd: string; centerLat: number; centerLng: number }[]).filter((r) => r.sigCd.startsWith("50"));
    expect(jeju).toHaveLength(2);
    for (const r of jeju) {
      const p = projectToMap(r.centerLat, r.centerLng);
      expect(p.x * MAP_IMAGE.width).toBeGreaterThan(235);
      expect(p.x * MAP_IMAGE.width).toBeLessThan(400);
      expect(p.y * MAP_IMAGE.height).toBeGreaterThan(1195);
      expect(p.y * MAP_IMAGE.height).toBeLessThan(1280);
    }
  });
});

describe("calendar helpers", () => {
  it("일요일 시작 7열 달력을 만듭니다 (2026년 10월 1일은 목요일)", () => {
    const weeks = buildMonthGrid("2026-10-01");
    expect(weeks[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("달 이동은 말일이 달라도 1일로 갑니다", () => {
    expect(shiftMonth("2026-01-01", 1)).toBe("2026-02-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("주말·기간 계산", () => {
    expect(nextSaturday("2026-10-11")).toBe("2026-10-17");
    expect(nextSaturday("2026-10-17")).toBe("2026-10-17");
    expect(inclusiveDays("2026-10-17", "2026-10-17")).toBe(1);
    expect(inclusiveDays("2026-10-17", "2026-10-23")).toBe(7);
  });

  it("이미 잡힌 여행 날짜를 막고, 내 여행은 뺄 수 있습니다", () => {
    const blocked = expandRanges(
      [
        { tripId: 1, startDate: "2026-10-13", endDate: "2026-10-14" },
        { tripId: 2, startDate: "2026-10-20", endDate: "2026-10-20" },
      ],
      2,
    );
    expect([...blocked].sort()).toEqual(["2026-10-13", "2026-10-14"]);
    expect(rangeHitsBlocked("2026-10-12", "2026-10-13", blocked)).toBe(true);
    expect(rangeHitsBlocked("2026-10-15", "2026-10-20", blocked)).toBe(false);
  });
});
