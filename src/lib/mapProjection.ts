// 3D 지형 지도(assets/illustrations/korea-terrain.webp, 1134×1368 — 피그마 Korea terrain 489:1492 3배)에서
// 위경도를 이미지 좌표(0~1)로 바꿉니다. 그림이 실제보다 동서로 넓게 단순화돼 있어 본토는 해안 랜드마크 9곳
// (고성·강릉(피그마 B3 핀)·호미곶·부산·해남 땅끝·목포·태안·강화·여수)으로 최소제곱 어파인 변환을 맞췄습니다.
// 최대 오차는 그림 폭의 약 5.5%라 "대략 그 지역"을 가리키는 용도입니다.
export const MAP_IMAGE = { width: 1134, height: 1368 } as const;

const NX = [0.201368, 0.002539, -25.304134] as const;
const NY = [0.023362, -0.184655, 4.196448] as const;

// 제주는 그림에서 따로 떨어진 섬이라 본토 변환을 쓰지 않고, 실제 섬 범위를 그림 속 섬 윗면 상자에 맞춥니다.
const JEJU = {
  maxLat: 33.75,
  lat: [33.2, 33.56],
  lng: [126.16, 126.94],
  x: [245 / MAP_IMAGE.width, 395 / MAP_IMAGE.width],
  y: [1272 / MAP_IMAGE.height, 1200 / MAP_IMAGE.height],
} as const;

// 그림에 땅·섬이 그려진 범위(0~1). 옹진군(서해 섬)·울릉군처럼 그림 밖으로 계산되는 지역은
// 이 범위 가장자리(바다 위 섬 자리)로 붙여 핀이 지도 밖에 떨어지지 않게 합니다.
const LAND = { minX: 0.09, maxX: 0.925, minY: 0.066, maxY: 0.95 } as const;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (t: number, [a, b]: readonly [number, number]) => a + (b - a) * t;

/** 위경도 → 지도 이미지 기준 0~1 좌표 (그림 범위 안으로 보정) */
export function projectToMap(lat: number, lng: number) {
  if (lat < JEJU.maxLat) {
    const tx = clamp((lng - JEJU.lng[0]) / (JEJU.lng[1] - JEJU.lng[0]), 0, 1);
    const ty = clamp((lat - JEJU.lat[0]) / (JEJU.lat[1] - JEJU.lat[0]), 0, 1);
    return { x: lerp(tx, JEJU.x), y: lerp(ty, JEJU.y) };
  }
  return {
    x: clamp(NX[0] * lng + NX[1] * lat + NX[2], LAND.minX, LAND.maxX),
    y: clamp(NY[0] * lng + NY[1] * lat + NY[2], LAND.minY, LAND.maxY),
  };
}
