import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { AppState } from "react-native";

import { tripApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { Presence } from "@/api/types";
import { useAuthStore } from "@/store/auth";

const DEFAULT_SECONDS = 20;

/**
 * "민지가 보고 있어요" (D12, 3-11·3-12). 코스 화면이 보이고 앱이 앞에 있는 동안만
 * heartbeatSeconds(20초)마다 신호를 보내고 보고 있는 참여자를 다시 받습니다. 화면을 떠나면 멈춥니다.
 * 반환: 나를 뺀 닉네임 목록
 */
export function usePresence(tripId: number, enabled: boolean) {
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const key = queryKeys.presence(tripId);
  // 데이터는 아래 루프가 채웁니다 (자동 조회 없음)
  const presence = useQuery<Presence>({ queryKey: key, queryFn: () => tripApi.presence(tripId), enabled: false });

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let stopped = false;
      let seconds = DEFAULT_SECONDS;

      const tick = async () => {
        try {
          await tripApi.heartbeat(tripId);
          const next = await tripApi.presence(tripId);
          seconds = next.heartbeatSeconds || DEFAULT_SECONDS;
          queryClient.setQueryData(queryKeys.presence(tripId), next);
        } catch {
          // 접속 표시는 부가 기능이라 실패해도 조용히 다음 주기에 다시 합니다.
        }
        if (!stopped && AppState.currentState === "active") timer = setTimeout(tick, seconds * 1000);
      };
      const stop = () => {
        if (timer) clearTimeout(timer);
        timer = null;
      };

      const sub = AppState.addEventListener("change", (state) => {
        stop();
        if (state === "active" && !stopped) void tick();
      });
      void tick();
      return () => {
        stopped = true;
        stop();
        sub.remove();
      };
    }, [enabled, tripId, queryClient]),
  );

  return (presence.data?.participants ?? []).filter((p) => p.userId !== myId).map((p) => p.nickname);
}
