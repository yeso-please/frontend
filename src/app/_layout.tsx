import { KeaniaOne_400Regular } from "@expo-google-fonts/keania-one";
import { NotoSansKR_400Regular, NotoSansKR_500Medium, NotoSansKR_700Bold, useFonts } from "@expo-google-fonts/noto-sans-kr";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { refreshSession } from "@/api/client";
import { AppProviders } from "@/providers/AppProviders";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ NotoSansKR_400Regular, NotoSansKR_500Medium, NotoSansKR_700Bold, KeaniaOne_400Regular });
  const status = useAuthStore((s) => s.status);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);

  // 앱 진입: refresh 쿠키로 로그인 상태를 복구합니다. 실패하면 로그인 화면.
  useEffect(() => {
    refreshSession().catch(() => useAuthStore.getState().signOut());
  }, []);

  const ready = fontsLoaded && status !== "booting";
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = status === "signedIn";
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: colors.white } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboardingCompleted}>
          <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboardingCompleted}>
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          <Stack.Screen name="trip" />
          <Stack.Screen name="my" />
        </Stack.Protected>
      </Stack>
    </AppProviders>
  );
}
