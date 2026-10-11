import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View, type TextInput } from "react-native";
import { toast } from "sonner-native";

import { KAKAO_ENABLED, KAKAO_REDIRECT_URI, USE_MOCK } from "@/api/config";
import { authApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { AuthLayout, Field } from "@/components/auth/AuthForm";
import { AppText, BottomCTA, Button } from "@/components/ui";
import { KakaoButton } from "@/features/auth/KakaoButton";
import { haptics } from "@/lib/haptics";
import { useAuthStore } from "@/store/auth";
import { colors, space } from "@/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState(USE_MOCK ? "demo@tripin.app" : "");
  const [password, setPassword] = useState(USE_MOCK ? "tripin1234" : "");
  const setSession = useAuthStore((s) => s.setSession);
  const passwordRef = useRef<TextInput>(null);

  const login = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: (res) => {
      haptics.confirm();
      setSession(res);
    },
    onError: () => haptics.reject(),
  });

  // 목업에서는 카카오 서버 없이 바로 소셜 회원으로 로그인합니다 (실제로는 웹뷰 화면을 거칩니다)
  const mockKakao = useMutation({
    mutationFn: () => authApi.kakao({ code: "mock-kakao-user", redirectUri: KAKAO_REDIRECT_URI || "http://localhost:5173/auth/kakao/callback" }),
    onSuccess: (res) => {
      haptics.confirm();
      setSession(res);
    },
    onError: (e) => {
      haptics.reject();
      toast.error(errorMessage(e));
    },
  });
  const startKakao = () => (USE_MOCK ? mockKakao.mutate() : router.push("/(auth)/kakao"));

  const error = login.error;
  const credentialError = isApiError(error, "AUTH_INVALID_CREDENTIALS") ? error.message : undefined;

  return (
    <AuthLayout
      title="다시 만나서 반가워요"
      subtitle="로그인하고 우연이 만든 여행을 이어가요."
      footer={
        <BottomCTA helper="처음이신가요? 회원가입" onHelperPress={() => router.push("/(auth)/signup")}>
          <Button label="로그인" loading={login.isPending} disabled={!email || !password} onPress={() => login.mutate()} />
          {KAKAO_ENABLED ? (
            <>
              <View style={styles.divider}>
                <View style={styles.line} />
                <AppText variant="small12" color="muted">
                  또는
                </AppText>
                <View style={styles.line} />
              </View>
              <KakaoButton onPress={startKakao} loading={mockKakao.isPending} />
            </>
          ) : null}
        </BottomCTA>
      }
    >
      <Field
        label="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@example.com"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Field
        ref={passwordRef}
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        returnKeyType="go"
        autoComplete="password"
        placeholder="8자 이상"
        error={credentialError ?? (error && !credentialError ? error.message : undefined)}
        onSubmitEditing={() => {
          if (email && password && !login.isPending) login.mutate();
        }}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: "row", alignItems: "center", gap: space[8], marginVertical: space[12] },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
