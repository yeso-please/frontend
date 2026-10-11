import { KAKAO_REDIRECT_URI, KAKAO_REST_API_KEY } from "@/api/config";

// 카카오 로그인 (백엔드 docs/api/auth.md 1-6, 웹 리다이렉트 방식)
// 앱은 카카오 인가 페이지를 웹뷰로 열고, 등록된 redirect URI로 이동하는 순간 code를 가로채 서버(POST /auth/kakao)에 넘깁니다.

/** CSRF 방지용 state. 암호학적 난수가 필요하진 않지만 예측하기 어렵게 만듭니다. */
export const createState = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

export const kakaoAuthorizeUrl = (state: string) =>
  "https://kauth.kakao.com/oauth/authorize" +
  `?client_id=${encodeURIComponent(KAKAO_REST_API_KEY)}` +
  `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
  "&response_type=code" +
  `&state=${encodeURIComponent(state)}`;

/** redirect URI로 돌아온 주소인지 (쿼리만 다르고 경로는 정확히 같아야 합니다) */
export const isKakaoRedirect = (url: string) => !!KAKAO_REDIRECT_URI && (url === KAKAO_REDIRECT_URI || url.startsWith(`${KAKAO_REDIRECT_URI}?`));

/** "…/callback?code=a&state=b" → { code: "a", state: "b" } */
export function parseQuery(url: string): Record<string, string> {
  const query = url.split("?")[1]?.split("#")[0] ?? "";
  return Object.fromEntries(
    query
      .split("&")
      .filter(Boolean)
      .map((pair) => {
        const [k, v = ""] = pair.split("=");
        return [decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, " "))];
      }),
  );
}

/** 카카오톡 앱으로 넘기는 링크 (웹뷰에서는 열 수 없어 카카오계정 로그인으로 안내합니다) */
export const isAppSchemeLink = (url: string) => /^(intent|kakaotalk|kakaokompassauth|market):/i.test(url);
