// .env.local 의 EXPO_PUBLIC_* 값 (빌드 시점에 번들에 들어갑니다)
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";
export const USE_MOCK = process.env.EXPO_PUBLIC_API_MOCK === "true";

// 카카오 로그인 (값은 .env.local에 둡니다. 비어 있으면 카카오 버튼을 숨깁니다)
export const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? "";
/** 카카오 콘솔과 백엔드 허용 목록(auth.kakao.allowed-redirect-uris)에 등록된 주소와 정확히 같아야 합니다 */
export const KAKAO_REDIRECT_URI = process.env.EXPO_PUBLIC_KAKAO_REDIRECT_URI ?? "";
export const KAKAO_ENABLED = USE_MOCK || (!!KAKAO_REST_API_KEY && !!KAKAO_REDIRECT_URI);

// 카카오맵 JavaScript SDK (코스 경로 지도·장소 편집 지도). 웹뷰 페이지의 출처(KAKAO_MAP_ORIGIN)가
// 카카오 디벨로퍼스 앱 > 플랫폼 > Web 사이트 도메인에 등록돼 있어야 지도가 뜹니다 (아니면 SDK가 401 domain mismatched).
// 지도 HTML은 웹뷰 안에 직접 넣으므로 이 주소로 실제 요청은 가지 않고 출처(Referer)로만 쓰입니다.
// 2026-10-22 기준 팀 카카오 앱에 등록된 Web 도메인은 http://localhost:8080 입니다 (5173은 미등록).
export const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? "";
export const KAKAO_MAP_ORIGIN = process.env.EXPO_PUBLIC_KAKAO_MAP_ORIGIN ?? "http://localhost:8080";

/** 공유·초대 링크의 앱 딥링크 주소 (예: tripin://invite/iv_xxx). 웹 도메인이 생기면 교체합니다. */
export const LINK_BASE_URL = "tripin://";

export const REQUEST_TIMEOUT_MS = 15000;
