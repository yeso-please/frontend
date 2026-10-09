// 일러스트 지도(assets/illustrations/korea-map.webp, 984×1230)에서 위경도를 이미지 좌표로 바꿉니다.
// 그림이 실제 지도를 단순화한 것이라 랜드마크 9곳(서울타워·설악산·대전·대구·부산·호미곶·한라산·수원·전주)으로
// 최소제곱 어파인 변환을 맞췄습니다. 평균 오차는 이미지 폭의 약 5%라 "대략 그 지역"을 가리키는 용도입니다.
export const MAP_IMAGE = { width: 984, height: 1230 } as const;

const NX = [0.183633, 0.009198, -23.280122] as const;
const NY = [0.029133, -0.164039, 2.665922] as const;

/** 위경도 → 지도 이미지 기준 0~1 좌표 */
export function projectToMap(lat: number, lng: number) {
  return {
    x: NX[0] * lng + NX[1] * lat + NX[2],
    y: NY[0] * lng + NY[1] * lat + NY[2],
  };
}
