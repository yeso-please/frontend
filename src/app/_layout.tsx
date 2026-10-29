import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { refreshSession } from "@/api/client";
import { StartScreen } from "@/components/StartScreen";
import { AppProviders } from "@/providers/AppProviders";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  // Noto Sans KR은 쓰는 굵기 3개만, 한글 완성형·자모·영문·기호만 남긴 서브셋입니다 (assets/fonts, OFL).
  // 구글 폰트 패키지를 통째로 불러오면 9개 굵기(약 53MB)가 모두 앱에 들어갑니다.
  const [fontsLoaded] = useFonts({
    NotoSansKR_400Regular: require("@/assets/fonts/NotoSansKR-Regular.ttf"),
    NotoSansKR_500Medium: require("@/assets/fonts/NotoSansKR-Medium.ttf"),
    NotoSansKR_700Bold: require("@/assets/fonts/NotoSansKR-Bold.ttf"),
    KeaniaOne_400Regular: require("@/assets/fonts/KeaniaOne-Regular.ttf"),
  });
  const status = useAuthStore((s) => s.status);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);

  // 앱 진입: refresh 쿠키로 로그인 상태를 복구합니다. 실패하면 로그인 화면.
  useEffect(() => {
    refreshSession().catch(() => useAuthStore.getState().signOut());
  }, []);

  const ready = fontsLoaded && status !== "booting";
  // 피그마 시작화면: 기본 스플래시는 시작화면 첫 그림이 나오면 내리고, 앱은 준비되는 대로 그 아래에 그려 둡니다.
  const [startDone, setStartDone] = useState(false);
  // 시작화면 그림이 늦게 뜨더라도 기본 스플래시가 계속 남지 않게 합니다.
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync(), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <StatusBar style="dark" />
      {ready ? <AppStack signedIn={status === "signedIn"} onboardingCompleted={onboardingCompleted} /> : null}
      {startDone ? null : <StartScreen ready={ready} onShown={() => SplashScreen.hideAsync()} onDone={() => setStartDone(true)} />}
    </View>
  );
}

function AppStack({ signedIn, onboardingCompleted }: { signedIn: boolean; onboardingCompleted: boolean }) {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: colors.white } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboardingCompleted}>
          <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboardingCompleted}>
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          <Stack.Screen name="region" />
          <Stack.Screen name="trip" />
          <Stack.Screen name="invites" />
          <Stack.Screen name="survey" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="diary" />
          <Stack.Screen name="my" />
        </Stack.Protected>
        {/* 초대 링크(tripin://invite/{token})·친구 초대 링크(tripin://friend/{token})는 로그인 전에도 열립니다 — 미리보기는 공개 API (4-4·4-16·2-7) */}
        <Stack.Screen name="invite" />
        <Stack.Screen name="friend/[token]" />
        <Stack.Screen name="diary-link/[token]" />
        {/* 코스 공유 링크(tripin://course/{token})도 로그인 없이 읽기 전용으로 열립니다 (4-12·4-13) */}
        <Stack.Screen name="course/[token]" />
      </Stack>
    </AppProviders>
  );
}
