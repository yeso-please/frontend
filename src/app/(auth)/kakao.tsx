import { router } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { toast } from "sonner-native";
import { WebView, type WebViewNavigation } from "react-native-webview";

import { KAKAO_REDIRECT_URI } from "@/api/config";
import { authApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { LoadingView, Screen, TopBar } from "@/components/ui";
import { createState, isAppSchemeLink, isKakaoRedirect, kakaoAuthorizeUrl, parseQuery } from "@/features/auth/kakao";
import { haptics } from "@/lib/haptics";
import { useAuthStore } from "@/store/auth";

const close = () => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"));

/** 카카오 인가 페이지를 웹뷰로 열고, redirect URI로 돌아오면 code를 서버에 넘겨 로그인합니다. */
export default function KakaoLoginScreen() {
  const [state] = useState(createState);
  const [exchanging, setExchanging] = useState(false);
  const handled = useRef(false);

  const finish = async (url: string) => {
    if (handled.current) return;
    handled.current = true;
    const query = parseQuery(url);
    if (query.error) {
      // 사용자가 동의 화면에서 취소한 경우 등
      toast(query.error === "access_denied" ? "카카오 로그인을 취소했어요" : "카카오 로그인에 실패했어요");
      close();
      return;
    }
    if (!query.code || query.state !== state) {
      haptics.reject();
      toast.error("로그인 요청이 올바르지 않아요. 다시 시도해 주세요.");
      close();
      return;
    }
    setExchanging(true);
    try {
      const res = await authApi.kakao({ code: query.code, redirectUri: KAKAO_REDIRECT_URI });
      haptics.confirm();
      // 루트 가드가 온보딩/탭으로 바꿔 줍니다
      useAuthStore.getState().setSession(res);
    } catch (e) {
      haptics.reject();
      if (isApiError(e, "AUTH_KAKAO_UNAVAILABLE")) toast.error("카카오 서버에 연결할 수 없어요. 이메일로 로그인해 주세요.");
      else if (isApiError(e, "AUTH_KAKAO_NOT_CONFIGURED")) toast.error("서버에 카카오 로그인 설정이 없어요.");
      else toast.error(errorMessage(e));
      close();
    }
  };

  const onShouldStart = (req: WebViewNavigation) => {
    if (isKakaoRedirect(req.url)) {
      finish(req.url);
      return false;
    }
    if (isAppSchemeLink(req.url)) {
      toast("카카오계정(이메일·전화번호)으로 로그인해 주세요");
      return false;
    }
    return true;
  };

  return (
    <Screen>
      <TopBar title="카카오 로그인" onBack={close} />
      {exchanging ? (
        <LoadingView label="로그인하는 중이에요" />
      ) : (
        <View style={styles.web}>
          <WebView
            source={{ uri: kakaoAuthorizeUrl(state) }}
            onShouldStartLoadWithRequest={onShouldStart}
            // Android는 리다이렉트를 onShouldStart로 못 잡는 경우가 있어 한 번 더 확인합니다
            onNavigationStateChange={(nav) => {
              if (isKakaoRedirect(nav.url)) finish(nav.url);
            }}
            startInLoadingState
            renderLoading={() => <LoadingView label="카카오 로그인 화면을 여는 중이에요" />}
            incognito
            setSupportMultipleWindows={false}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1 },
});
