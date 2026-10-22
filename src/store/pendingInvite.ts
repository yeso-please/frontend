import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// 로그인 전에 초대 링크(tripin://invite/{token})로 들어온 사람이 가입·설문을 마친 뒤 같은 초대로 돌아오도록 토큰을 기억합니다.
// 가입 화면으로 보내기 직전에 저장하고, 로그인·설문을 마친 상태로 초대 화면에 다시 들어오면 지웁니다.
// 앱을 껐다 켜도 남도록 AsyncStorage에 둡니다 (토큰은 7일이면 만료되므로 그보다 오래된 값은 버립니다).

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type PendingInviteState = {
  token: string | null;
  savedAt: number | null;
  remember: (token: string) => void;
  clear: () => void;
};

export const usePendingInvite = create<PendingInviteState>()(
  persist(
    (set) => ({
      token: null,
      savedAt: null,
      remember: (token) => set({ token, savedAt: Date.now() }),
      clear: () => set({ token: null, savedAt: null }),
    }),
    {
      name: "tripin.pending-invite.v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ token, savedAt }) => ({ token, savedAt }),
    },
  ),
);

/** 기억해 둔 초대 토큰 (오래된 값은 없는 것으로 봅니다) */
export function pendingInviteToken(now = Date.now()): string | null {
  const { token, savedAt } = usePendingInvite.getState();
  if (!token || savedAt == null || now - savedAt > MAX_AGE_MS) return null;
  return token;
}
