import { create } from "zustand";

import type { MapRegion } from "./lib/regions";

/** 01 홈 → 02 핀 찾는 중 → 03·04 여행지 발견 */
export type HomePhase = "idle" | "drawing" | "found";
/** random: 랜덤 핀 꽂기(핀이 여기저기 들렀다 떨어짐) · manual: 직접 고르기(바로 떨어짐) */
export type DrawMode = "random" | "manual";

type HomeDrawState = {
  phase: HomePhase;
  mode: DrawMode;
  /** 지금 핀이 향하는 지역 */
  target: MapRegion | null;
  /** 화면(헤드라인·라벨·시트)에 보여 주는 결과. 다시 뽑는 동안에는 이전 결과를 유지합니다. */
  result: MapRegion | null;
  start: (target: MapRegion, mode: DrawMode) => void;
  land: () => void;
};

// 탭을 오가거나 여행 만들기 화면에서 돌아와도 마지막 결과가 남도록 화면 밖(zustand)에 둡니다.
export const useHomeDraw = create<HomeDrawState>((set) => ({
  phase: "idle",
  mode: "random",
  target: null,
  result: null,
  start: (target, mode) => set({ phase: "drawing", mode, target }),
  land: () => set((s) => ({ phase: "found", result: s.target })),
}));
