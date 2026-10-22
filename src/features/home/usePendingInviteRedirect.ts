import { router } from "expo-router";
import { useEffect } from "react";

import { pendingInviteToken, usePendingInvite } from "@/store/pendingInvite";

/**
 * 로그인 전에 초대 링크로 들어와 가입·설문을 마친 사람을 그 초대로 돌려보냅니다.
 * 홈은 로그인·설문을 마치면 처음 보이는 화면이라 여기서 확인합니다. 토큰은 초대 화면이 열리면 지웁니다.
 */
export function usePendingInviteRedirect() {
  const hydrated = usePendingInvite.persist.hasHydrated();
  const token = usePendingInvite((s) => s.token);

  useEffect(() => {
    if (!hydrated) return;
    const valid = pendingInviteToken();
    if (!valid) {
      if (token) usePendingInvite.getState().clear();
      return;
    }
    // 탭 화면이 그려진 다음에 이동해야 뒤로 가기가 홈으로 돌아옵니다.
    const timer = setTimeout(() => router.push({ pathname: "/invite/[token]", params: { token: valid } }), 250);
    return () => clearTimeout(timer);
  }, [hydrated, token]);
}
