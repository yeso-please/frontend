jest.mock("@/api/config", () => ({
  KAKAO_REST_API_KEY: "test-rest-key",
  KAKAO_REDIRECT_URI: "http://localhost:5173/auth/kakao/callback",
}));

import { createState, isAppSchemeLink, isKakaoRedirect, kakaoAuthorizeUrl, parseQuery } from "@/features/auth/kakao";

describe("카카오 로그인 도우미", () => {
  it("인가 URL에 client_id·redirect_uri·state를 인코딩해 담습니다", () => {
    const url = kakaoAuthorizeUrl("abc 123");
    expect(url.startsWith("https://kauth.kakao.com/oauth/authorize?")).toBe(true);
    const q = parseQuery(url);
    expect(q).toEqual({
      client_id: "test-rest-key",
      redirect_uri: "http://localhost:5173/auth/kakao/callback",
      response_type: "code",
      state: "abc 123",
    });
  });

  it("등록된 redirect URI로 돌아온 주소만 가로챕니다", () => {
    expect(isKakaoRedirect("http://localhost:5173/auth/kakao/callback?code=x&state=y")).toBe(true);
    expect(isKakaoRedirect("http://localhost:5173/auth/kakao/callback")).toBe(true);
    // 경로가 비슷하지만 다른 주소, 다른 호스트는 무시합니다 (open redirect 방지)
    expect(isKakaoRedirect("http://localhost:5173/auth/kakao/callback-evil?code=x")).toBe(false);
    expect(isKakaoRedirect("https://evil.example/auth/kakao/callback?code=x")).toBe(false);
    expect(isKakaoRedirect("https://kauth.kakao.com/oauth/authorize?client_id=a")).toBe(false);
  });

  it("code·state·error 쿼리를 꺼냅니다 (인코딩·+ 공백·해시 처리)", () => {
    expect(parseQuery("http://x/cb?code=a%2Fb&state=s+1#frag")).toEqual({ code: "a/b", state: "s 1" });
    expect(parseQuery("http://x/cb?error=access_denied&error_description=User%20denied")).toEqual({ error: "access_denied", error_description: "User denied" });
    expect(parseQuery("http://x/cb")).toEqual({});
  });

  it("카카오톡 앱으로 넘기는 링크는 웹뷰에서 막습니다", () => {
    expect(isAppSchemeLink("intent://kakaotalk#Intent;end")).toBe(true);
    expect(isAppSchemeLink("kakaotalk://login")).toBe(true);
    expect(isAppSchemeLink("https://accounts.kakao.com/login")).toBe(false);
  });

  it("state는 매번 다르고 충분히 깁니다", () => {
    const a = createState();
    const b = createState();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(16);
  });
});
