import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";

import { authApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { USE_MOCK } from "@/api/config";
import { AuthLayout, Field } from "@/components/auth/AuthForm";
import { BottomCTA, Button } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useAuthStore } from "@/store/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState(USE_MOCK ? "demo@tripin.app" : "");
  const [password, setPassword] = useState(USE_MOCK ? "tripin1234" : "");
  const setSession = useAuthStore((s) => s.setSession);

  const login = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: (res) => {
      haptics.confirm();
      setSession(res);
    },
    onError: () => haptics.reject(),
  });

  const error = login.error;
  const credentialError = isApiError(error, "AUTH_INVALID_CREDENTIALS") ? error.message : undefined;

  return (
    <AuthLayout
      title="다시 만나서 반가워요"
      subtitle="로그인하고 우연이 만든 여행을 이어가요."
      footer={
        <BottomCTA helper="처음이신가요? 회원가입" onHelperPress={() => router.push("/(auth)/signup")}>
          <Button label="로그인" loading={login.isPending} disabled={!email || !password} onPress={() => login.mutate()} />
        </BottomCTA>
      }
    >
      <Field label="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Field
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        placeholder="8자 이상"
        error={credentialError ?? (error && !credentialError ? error.message : undefined)}
        onSubmitEditing={() => login.mutate()}
      />
    </AuthLayout>
  );
}
