import { create } from "zustand";

import type { AuthResponse, User } from "@/api/types";

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
  signOut: () => set({ status: "signedOut", accessToken: null, user: null, onboardingCompleted: false }),
}));
