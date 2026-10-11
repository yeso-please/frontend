import { Stack } from "expo-router";

import { colors } from "@/theme";

// 그룹의 첫 화면을 고정합니다. 지정하지 않으면 파일 이름 순서상 kakao 화면이 첫 화면이 됩니다.
export const unstable_settings = { initialRouteName: "login" };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: colors.white } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="kakao" options={{ animation: "slide_from_bottom" }} />
    </Stack>
  );
}
