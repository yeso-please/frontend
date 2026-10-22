import { create } from "zustand";

import type { DrawCondition } from "@/api/types";

import type { DiscoveredRegion } from "./lib/regions";

/** B1 기본 지도 → B2 핀 모드(서버가 뽑는 중) → B3 지역 발견 */
export type DiscoverPhase = "idle" | "drawing" | "found";
/** random: 서버 추첨(핀이 여기저기 들렀다 떨어짐) · manual: 직접 고르기(바로 떨어짐) */
export type DrawMode = "random" | "manual";

type DiscoverState = {
  phase: DiscoverPhase;
  mode: DrawMode;
  /** 화면(헤드라인·라벨·시트)에 보여 주는 결과. 다시 뽑는 동안에는 이전 결과를 유지합니다. */
  result: DiscoveredRegion | null;
  /** 조건 뽑기 (D1: DISTANCE·MY_TASTE 중 앱은 위치 권한이 없어 MY_TASTE만 씁니다). 비면 완전 랜덤 */
  conditions: DrawCondition[];
  /** B4 "다시 뽑기" → 여행 탭이 포커스를 받으면 다시 뽑습니다 (값이 바뀔 때마다 한 번) */
  redrawRequest: number;
  start: (mode: DrawMode) => void;
  land: (result: DiscoveredRegion) => void;
  cancel: () => void;
  /** 처음 지도(B1)로 — 결과를 지웁니다 */
  clear: () => void;
  setConditions: (conditions: DrawCondition[]) => void;
  requestRedraw: () => void;
};

// 탭을 오가거나 B4·여행 만들기 화면에서 돌아와도 마지막 결과가 남도록 화면 밖(zustand)에 둡니다.
export const useDiscoverDraw = create<DiscoverState>((set) => ({
  phase: "idle",
  mode: "random",
  result: null,
  conditions: [],
  redrawRequest: 0,
  start: (mode) => set({ phase: "drawing", mode }),
  land: (result) => set({ phase: "found", result }),
  // 추첨이 실패하면 이전 결과가 있으면 그 화면으로, 없으면 처음 지도로 돌아갑니다.
  cancel: () => set((s) => ({ phase: s.result ? "found" : "idle" })),
  clear: () => set({ phase: "idle", result: null }),
  setConditions: (conditions) => set({ conditions }),
  requestRedraw: () => set((s) => ({ redrawRequest: s.redrawRequest + 1 })),
}));
