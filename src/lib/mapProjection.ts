// 일러스트 지도(assets/illustrations/korea-map.webp, 984×1230)에서 위경도를 이미지 좌표로 바꿉니다.
// 그림이 실제 지도를 단순화한 것이라 랜드마크 9곳(서울타워·설악산·대전·대구·부산·호미곶·한라산·수원·전주)으로
// 최소제곱 어파인 변환을 맞췄습니다. 평균 오차는 이미지 폭의 약 5%라 "대략 그 지역"을 가리키는 용도입니다.
export const MAP_IMAGE = { width: 984, height: 1230 } as const;

const NX = [0.183633, 0.009198, -23.280122] as const;
const NY = [0.029133, -0.164039, 2.665922] as const;

// 그림에 실제로 땅이 그려진 범위(투명하지 않은 영역, 0~1). 옹진군(서해 섬)·울릉군처럼 그림 밖으로
// 계산되는 지역은 이 범위 가장자리로 붙여 핀이 지도 밖에 떨어지지 않게 합니다.
const LAND = { minX: 0.09, maxX: 0.93, minY: 0.04, maxY: 0.95 } as const;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 위경도 → 지도 이미지 기준 0~1 좌표 (그림 범위 안으로 보정) */
export function projectToMap(lat: number, lng: number) {
  return {
    x: clamp(NX[0] * lng + NX[1] * lat + NX[2], LAND.minX, LAND.maxX),
    y: clamp(NY[0] * lng + NY[1] * lat + NY[2], LAND.minY, LAND.maxY),
  };
}
