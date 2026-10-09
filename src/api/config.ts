// .env.local 의 EXPO_PUBLIC_* 값 (빌드 시점에 번들에 들어갑니다)
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";
export const USE_MOCK = process.env.EXPO_PUBLIC_API_MOCK === "true";

/** 공유·초대 링크의 앱 딥링크 주소 (예: tripin://invite/iv_xxx). 웹 도메인이 생기면 교체합니다. */
export const LINK_BASE_URL = "tripin://";

export const REQUEST_TIMEOUT_MS = 15000;
