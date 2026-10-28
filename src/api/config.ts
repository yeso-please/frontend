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

/** 앱 딥링크 주소 (예: tripin://invite/iv_xxx) */
export const LINK_BASE_URL = "tripin://";
/**
 * 서버가 https(AWS CloudFront)면 그 웹 주소. 같은 도메인의 안내 페이지(/invite/{token} 등)가 앱을 열고, 앱이 없으면 앱 받기로 보냅니다.
 * 로컬·목업 서버면 null입니다.
 */
export const PUBLIC_WEB_URL = !USE_MOCK && API_BASE_URL.startsWith("https://") ? API_BASE_URL.replace(/\/api\/?$/, "") : null;

/**
 * 남에게 보내는 링크. 카카오톡 같은 메신저는 tripin:// 주소를 누를 수 없어서, 웹 주소가 있으면 https 안내 페이지 주소로 보냅니다.
 * path는 앱 경로와 같습니다: invite/{token}, friend/{token}, course/{token}, diary-link/{token}
 */
export const shareUrl = (path: string) => (PUBLIC_WEB_URL ? `${PUBLIC_WEB_URL}/${path}` : `${LINK_BASE_URL}${path}`);

export const REQUEST_TIMEOUT_MS = 15000;
