// 카카오맵 앱·웹으로 넘기는 링크. 지도 URL 형식은 https://map.kakao.com/link/map/{이름},{위도},{경도} 입니다.

/** 이름 속 쉼표·슬래시는 링크 구분자와 겹치므로 공백으로 바꾼 뒤 인코딩합니다. */
const cleanName = (name: string) => encodeURIComponent(name.replace(/[,/]/g, " ").replace(/\s+/g, " ").trim() || "장소");

const fixed = (n: number) => Number(n.toFixed(6));

/** 한 장소를 카카오맵에서 엽니다 (지도 화면) */
export function kakaoMapLink(name: string, lat: number, lng: number): string {
  return `https://map.kakao.com/link/map/${cleanName(name)},${fixed(lat)},${fixed(lng)}`;
}

/** 그 장소 주변을 이름으로 검색합니다 */
export function kakaoMapSearchLink(query: string): string {
  return `https://map.kakao.com/link/search/${cleanName(query)}`;
}

/** 점 목록의 범위. 비어 있으면 null */
export function boundsOf(points: { lat: number; lng: number }[]) {
  if (points.length === 0) return null;
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}
