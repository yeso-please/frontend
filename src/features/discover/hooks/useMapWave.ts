import { useEffect, useMemo } from "react";
import {
  cancelAnimation,
  Easing,
  type SharedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { MAP_PIECES } from "../lib/koreaMap.generated";

// 도 조각의 무게중심(지도 0~1). 워크릿이 배열을 통째로 복사해 가므로 숫자만 따로 둡니다.
const PIECE_U = MAP_PIECES.map((p) => p.cu);
const PIECE_V = MAP_PIECES.map((p) => p.cv);

/** 파도가 지도 위 → 아래로 지나가는 동안 한 주기에서 차지하는 비율 (클수록 남쪽이 더 늦게 들림) */
const WAVE_SPAN = 0.85;
/** 한 조각이 들렸다 내려오는 데 쓰는 주기 비율 */
const WAVE_BUMP = 0.42;
/** 꾹 누르는 동안: 처음 → 다 모았을 때의 높이(dp)와 한 주기(ms) */
const AMP_MIN = 2.5;
const AMP_MAX = 9;
const PERIOD_SLOW = 1150;
const PERIOD_FAST = 680;
/** 착지 충격: 맞은 조각은 눌리고, 나머지는 거리만큼 늦게 튀어 오릅니다. */
const IMPACT_MS = 1100;
const IMPACT_AMP = 6;
const IMPACT_DIP = 3.5;
const IMPACT_SPEED = 1.5;
const IMPACT_WIDTH = 0.22;

export type MapWave = {
  /** 파도 시계 (주기 단위로 계속 늘어남) */
  phase: SharedValue<number>;
  /** 파도 높이 (dp, 지도 기준) */
  amp: SharedValue<number>;
  /** 모은 힘 0~1 — 파도가 빨라지고 높아집니다 */
  charge: SharedValue<number>;
  /** 착지 충격 진행 0~1 (-1 = 없음) · 맞은 자리 · 맞은 조각 */
  impact: SharedValue<number>;
  impactU: SharedValue<number>;
  impactV: SharedValue<number>;
  impactPiece: SharedValue<number>;
};

const bump = (t: number) => {
  "worklet";
  return t > 0 && t < 1 ? Math.sin(t * Math.PI) ** 2 : 0;
};

/** 조각 하나가 지금 들린 높이 (dp, 위로 +). 지도·핀·외곽선이 같은 값을 씁니다. */
export function pieceLift(wave: MapWave, index: number): number {
  "worklet";
  let lift = 0;
  const amp = wave.amp.value;
  if (amp > 0.01) {
    const local = (((wave.phase.value - PIECE_V[index] * WAVE_SPAN) % 1) + 1) % 1;
    lift += amp * bump(local / WAVE_BUMP);
  }
  const t = wave.impact.value;
  if (t >= 0 && t < 1) {
    const fade = (1 - t) * (1 - t);
    if (index === wave.impactPiece.value) {
      lift -= IMPACT_DIP * bump(t / 0.28);
    } else {
      const dist = Math.hypot(PIECE_U[index] - wave.impactU.value, PIECE_V[index] - wave.impactV.value);
      lift += IMPACT_AMP * fade * bump((t * IMPACT_SPEED - dist) / IMPACT_WIDTH);
    }
  }
  return lift;
}

/**
 * 여행 탭 지도 "땅 출렁임". 꾹 누르는 동안 도 조각들이 위에서 아래로 파도타기처럼 들렸다 내려가고,
 * 핀이 꽂히면 그 자리에서 충격이 퍼져 나갑니다. 모든 값은 UI 스레드의 shared value입니다.
 */
export function useMapWave() {
  const reducedMotion = useReducedMotion();
  const phase = useSharedValue(0);
  const amp = useSharedValue(0);
  const charge = useSharedValue(0);
  const impact = useSharedValue(-1);
  const impactU = useSharedValue(0.5);
  const impactV = useSharedValue(0.5);
  const impactPiece = useSharedValue(-1);

  // 파도가 있을 때만 시계를 돌립니다 (모은 힘만큼 빨라짐).
  const clock = useFrameCallback((frame) => {
    const dt = frame.timeSincePreviousFrame ?? 16;
    const period = PERIOD_SLOW + (PERIOD_FAST - PERIOD_SLOW) * charge.value;
    phase.value += dt / period;
  }, false);

  useEffect(
    () => () => {
      [amp, charge, impact].forEach((sv) => cancelAnimation(sv));
    },
    [amp, charge, impact],
  );

  /** 힘 모으기 시작: 파도가 일고 ms 동안 점점 세집니다. */
  const startCharge = (ms: number) => {
    if (reducedMotion) return;
    phase.set(0);
    clock.setActive(true);
    charge.set(withTiming(1, { duration: ms, easing: Easing.out(Easing.quad) }));
    amp.set(withSequence(withTiming(AMP_MIN, { duration: 180 }), withTiming(AMP_MAX, { duration: ms, easing: Easing.out(Easing.quad) })));
  };

  const stopClock = () => clock.setActive(false);

  /** 던진 뒤: 파도가 잦아듭니다. */
  const calm = () => {
    cancelAnimation(charge);
    charge.set(withTiming(0, { duration: 500 }));
    amp.set(
      withTiming(0, { duration: 520, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(stopClock);
      }),
    );
  };

  /** 핀이 붙어 있을 조각 (핀이 그 땅과 함께 들썩임). -1 = 없음 */
  const track = (piece: number) => impactPiece.set(piece);

  /** 핀이 꽂힌 자리에서 충격이 퍼집니다. */
  const hit = (u: number, v: number, piece: number) => {
    impactPiece.set(piece);
    if (reducedMotion) return;
    impactU.set(u);
    impactV.set(v);
    impact.set(0);
    impact.set(
      withTiming(1, { duration: IMPACT_MS, easing: Easing.linear }, (finished) => {
        if (finished) impact.value = -1;
      }),
    );
  };

  /** 바로 멈춤 (처음 지도로) */
  const stop = () => {
    [amp, charge, impact].forEach((sv) => cancelAnimation(sv));
    amp.set(0);
    charge.set(0);
    impact.set(-1);
    impactPiece.set(-1);
    clock.setActive(false);
  };

  const wave = useMemo<MapWave>(() => ({ phase, amp, charge, impact, impactU, impactV, impactPiece }), [phase, amp, charge, impact, impactU, impactV, impactPiece]);
  return { wave, startCharge, calm, track, hit, stop };
}
