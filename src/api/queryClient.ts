import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState, Platform } from "react-native";

import { isApiError } from "./errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx(권한·검증 오류)는 다시 시도해도 같으니 재시도하지 않습니다.
      retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
});

// 앱이 다시 앞으로 오면 오래된 쿼리를 새로고침합니다.
AppState.addEventListener("change", (status) => {
  if (Platform.OS !== "web") focusManager.setFocused(status === "active");
});

// 오프라인이면 쿼리를 멈췄다가 연결되면 이어서 받습니다.
onlineManager.setEventListener((setOnline) => {
  const sub = Network.addNetworkStateListener((state) => setOnline(!!state.isConnected));
  return () => sub.remove();
});
