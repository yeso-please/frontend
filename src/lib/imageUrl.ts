// 관광공사 이미지(tong.visitkorea.or.kr)는 http:// 주소로 오는데, 안드로이드 릴리스 빌드는 평문 HTTP를 막습니다.
// 같은 호스트가 https도 제공하므로 이미지 주소는 항상 이 함수를 거쳐 씁니다.
export function secureImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
}
