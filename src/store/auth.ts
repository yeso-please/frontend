import { create } from "zustand";

import type { AuthResponse, User } from "@/api/types";
import { useDiscoverDraw } from "@/features/discover/store";

import { useTripDraft } from "./tripDraft";

type AuthStatus = "booting" | "signedOut" | "signedIn";

type AuthState = {
  status: AuthStatus;
  /** access token은 메모리에만 둡니다. refresh token은 서버가 HttpOnly 쿠키로 관리합니다. */
  accessToken: string | null;
  user: User | null;
  onboardingCompleted: boolean;
  setSession: (res: AuthResponse) => void;
  setOnboardingCompleted: (done: boolean) => void;
  signOut: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: "booting",
  accessToken: null,
  user: null,
  onboardingCompleted: false,
  setSession: (res) =>
    set({ status: "signedIn", accessToken: res.accessToken, user: res.user, onboardingCompleted: res.onboardingCompleted }),
  setOnboardingCompleted: (done) => set({ onboardingCompleted: done }),
  // 로그아웃·세션 만료(api/client)·로그인 복구 실패 모두 여기를 지납니다. 다음 사람이 이전 사람의
  // 지역 뽑기 결과·여행 만들기 초안을 보지 않도록 사용자별 전역 상태를 함께 비웁니다.
  signOut: () => {
    useDiscoverDraw.getState().clear();
    useTripDraft.getState().reset();
    set({ status: "signedOut", accessToken: null, user: null, onboardingCompleted: false });
  },
}));
