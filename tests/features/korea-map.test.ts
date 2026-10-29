// 여행 탭 지도 조각·시군구 외곽선(scripts/korea-map/build.py 생성)이 앱이 쓰는 지역 코드와 맞는지 확인합니다.
import regions from "@/api/mock/regions.json";
import { legacySigCd, regionShape } from "@/features/discover/lib/koreaMap";
import { MAP_PIECES, REGION_SHAPES } from "@/features/discover/lib/koreaMap.generated";

/** "M x yL x y…Z" 외곽선 → 꼭짓점 목록 */
const parsePath = (d: string) =>
  d
    .split("Z")
    .filter(Boolean)
    .map((part) => part.slice(1).split("L").map((pt) => pt.split(" ").map(Number) as [number, number]));

/** 짝홀 규칙으로 점이 다각형 안에 있는지 */
const inside = (x: number, y: number, ring: [number, number][]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

describe("지도 조각·시군구 외곽선", () => {
  it("도 단위 조각 17장, 시도 코드가 겹치지 않습니다", () => {
    expect(MAP_PIECES).toHaveLength(17);
    expect(new Set(MAP_PIECES.map((p) => p.sido)).size).toBe(17);
  });

  it("앱이 받는 지역(sigCd)마다 외곽선이 있고, 자기 도 조각을 가리킵니다 (바뀐 코드는 옛 코드로)", () => {
    for (const r of regions) {
      const shape = regionShape(r.sigCd);
      expect({ code: r.sigCd, found: !!shape }).toEqual({ code: r.sigCd, found: true });
      expect(MAP_PIECES[shape!.piece].sido).toBe(legacySigCd(r.sigCd).slice(0, 2));
    }
  });

  it("강원·전북 새 코드와 군위 대구 편입 코드를 옛 경계로 찾습니다", () => {
    expect(legacySigCd("51150")).toBe("42150");
    expect(legacySigCd("52111")).toBe("45111");
    expect(legacySigCd("27720")).toBe("47720");
    expect(regionShape("51150")).toBe(REGION_SHAPES["42150"]);
  });

  it("핀 자리는 그 시군구 외곽선 안에 있습니다", () => {
    for (const [code, shape] of Object.entries(REGION_SHAPES)) {
      const x = shape.u * 1134;
      const y = shape.v * 1368;
      const rings = parsePath(shape.d + shape.extra);
      expect({ code, inside: rings.some((ring) => inside(x, y, ring)) }).toEqual({ code, inside: true });
    }
  });
});
