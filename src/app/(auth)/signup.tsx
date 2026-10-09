import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";

import { authApi } from "@/api/endpoints";
import { ApiError, isApiError } from "@/api/errors";
import { AuthLayout, Field } from "@/components/auth/AuthForm";
import { BottomCTA, Button } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useAuthStore } from "@/store/auth";

export default function SignupScreen() {
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const setSession = useAuthStore((s) => s.setSession);

  const signup = useMutation({
    mutationFn: () => authApi.signup({ email, password, nickname }),
    onSuccess: (res) => {
      haptics.confirm();
      setSession(res);
    },
    onError: () => haptics.reject(),
  });

  const err = signup.error instanceof ApiError ? signup.error : null;
  const fieldError = (field: string) => err?.fieldMessage(field);

  return (
    <AuthLayout
      title="트리핀 시작하기"
      subtitle="가입하면 취향을 묻고, 우연한 여행지로 안내해 드려요."
      footer={
        <BottomCTA helper="이미 계정이 있어요" onHelperPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}>
          <Button
            label="가입하기"
            loading={signup.isPending}
            disabled={!nickname.trim() || !email || password.length < 8}
            onPress={() => signup.mutate()}
          />
        </BottomCTA>
      }
    >
      <Field label="닉네임" value={nickname} onChangeText={setNickname} maxLength={30} placeholder="친구에게 보일 이름" error={fieldError("nickname")} />
      <Field
        label="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@example.com"
        error={fieldError("email") ?? (isApiError(err, "AUTH_DUPLICATE_EMAIL") ? err.message : undefined)}
      />
      <Field
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        maxLength={64}
        placeholder="8~64자"
        error={fieldError("password")}
      />
    </AuthLayout>
  );
}
