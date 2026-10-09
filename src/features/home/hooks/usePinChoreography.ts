import { useEffect } from "react";
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { motion } from "@/theme";

import type { MapPoint } from "../lib/regions";

// 핀 연출 타이밍 (ms). 랜덤 뽑기 전체 ≈ 1.8초: 첫 착지 380 + 들르기 2×300 + 마지막 낙하 560 + 여운
const DROP_IN_MS = 380;
const HOP_MS = 300;
const FINAL_RISE_MS = 260;
const FINAL_FALL_MS = 240;
const SQUASH_MS = 60;

/** 처음 나타날 때 떨어지기 시작하는 높이 */
const DROP_HEIGHT = 150;
/** 들를 때 튀어 오르는 높이 */
const HOP_HEIGHT = 30;
/** 마지막 낙하 전에 올라가는 높이 */
const FINAL_HEIGHT = 96;

const easeOut = Easing.out(Easing.quad);
const easeIn = Easing.in(Easing.quad);
const easeInOut = Easing.inOut(Easing.cubic);

type RunOptions = {
  /** 들를 자리 (빈 배열이면 바로 떨어짐) */
  spots: MapPoint[];
  target: MapPoint;
  /** 중간 자리에 닿을 때마다 */
  onHop: () => void;
  /** 최종 지역에 착지한 순간 */
  onLand: () => void;
};

/**
 * 02 "핀 찾는 중" 연출. 모든 값은 UI 스레드의 shared value라 JS가 바빠도 끊기지 않습니다.
 * - u, v: 지도 위 위치(0~1) · lift: 지면에서 띄운 높이(px, 음수 = 위)
 * - squash: 세로 배율(착지 순간 눌림) · glow/pulse: 착지 후 바닥 빛 · label: 지역 라벨 팝
 */
export function usePinChoreography() {
  const reducedMotion = useReducedMotion();
  const u = useSharedValue(0.5);
  const v = useSharedValue(0.5);
  const lift = useSharedValue(0);
  const squash = useSharedValue(1);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0);
  const pulse = useSharedValue(0);
  const label = useSharedValue(0);

  const all = [u, v, lift, squash, opacity, glow, pulse, label];
  const stopAll = () => all.forEach((sv) => cancelAnimation(sv));

  // 화면이 사라지면 진행 중인 연출과 무한 반복(글로우)을 멈춥니다.
  useEffect(() => () => [u, v, lift, squash, opacity, glow, pulse, label].forEach((sv) => cancelAnimation(sv)), [u, v, lift, squash, opacity, glow, pulse, label]);

  /** 결과 표시: 글로우가 퍼지며 반복되고 라벨이 톡 튀어나옵니다. */
  const showResult = () => {
    glow.set(withTiming(1, motion.timing.base));
    cancelAnimation(pulse);
    pulse.set(0);
    pulse.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
    label.set(withSpring(1, motion.spring.bouncy));
  };

  /** 다시 뽑기: 라벨·글로우를 거둡니다. */
  const hideResult = () => {
    cancelAnimation(pulse);
    pulse.set(withTiming(0, motion.timing.fast));
    glow.set(withTiming(0, motion.timing.fast));
    label.set(withTiming(0, motion.timing.fast));
  };

  /** 애니메이션 없이 그 자리에 꽂아 둡니다 (화면 복원용). */
  const placeAt = (point: MapPoint) => {
    stopAll();
    u.set(point.u);
    v.set(point.v);
    lift.set(0);
    squash.set(1);
    opacity.set(1);
    showResult();
  };

  /** 핀을 숨기고 처음 상태로 */
  const reset = () => {
    stopAll();
    opacity.set(0);
    glow.set(0);
    pulse.set(0);
    label.set(0);
    lift.set(0);
    squash.set(1);
  };

  const run = ({ spots, target, onHop, onLand }: RunOptions) => {
    const visible = opacity.get() > 0.5;
    const hopSpots = reducedMotion ? [] : spots;
    hideResult();
    cancelAnimation(u);
    cancelAnimation(v);
    cancelAnimation(lift);
    cancelAnimation(squash);

    const uSteps: number[] = [];
    const vSteps: number[] = [];
    const liftSteps: number[] = [];
    const squashSteps: number[] = [];

    const hopDone = (finished?: boolean) => {
      "worklet";
      if (finished) scheduleOnRN(onHop);
    };
    const landDone = (finished?: boolean) => {
      "worklet";
      if (finished) scheduleOnRN(onLand);
    };

    /** 공중에서 늘어났다가 닿는 순간 눌리는 한 번의 점프 */
    const hop = (to: MapPoint, duration: number, height: number) => {
      const half = duration / 2;
      uSteps.push(withTiming(to.u, { duration, easing: easeInOut }));
      vSteps.push(withTiming(to.v, { duration, easing: easeInOut }));
      liftSteps.push(withTiming(-height, { duration: half, easing: easeOut }), withTiming(0, { duration: half, easing: easeIn }, hopDone));
      squashSteps.push(withTiming(1.08, { duration: half }), withTiming(0.84, { duration: half }));
    };

    const [first, ...rest] = hopSpots;
    if (first) {
      if (visible) {
        // 다시 뽑기: 이전 핀이 뽑혀 첫 자리로 뛰어갑니다.
        hop(first, DROP_IN_MS, FINAL_HEIGHT * 0.6);
      } else {
        // 첫 뽑기: 첫 자리 위에서 떨어집니다.
        u.set(first.u);
        v.set(first.v);
        lift.set(-DROP_HEIGHT);
        squash.set(1.1);
        uSteps.push(withTiming(first.u, { duration: DROP_IN_MS }));
        vSteps.push(withTiming(first.v, { duration: DROP_IN_MS }));
        liftSteps.push(withTiming(0, { duration: DROP_IN_MS, easing: easeIn }, hopDone));
        squashSteps.push(withTiming(1.06, { duration: DROP_IN_MS - 80 }), withTiming(0.84, { duration: 80 }));
      }
      rest.forEach((spot) => hop(spot, HOP_MS, HOP_HEIGHT));
    } else if (!visible) {
      // 바로 떨어뜨리기(직접 선택·동작 줄이기): 최종 지역 위에서 시작
      u.set(target.u);
      v.set(target.v);
      lift.set(-DROP_HEIGHT);
      squash.set(1.1);
    }

    if (!first && !visible) {
      // 위에서 곧장 떨어집니다.
      liftSteps.push(withTiming(0, { duration: DROP_IN_MS, easing: easeIn }, landDone));
      squashSteps.push(withTiming(1.04, { duration: DROP_IN_MS }));
    } else {
      // 마지막: 높이 떠올라 최종 지역으로 날아간 뒤 떨어집니다.
      const moveMs = FINAL_RISE_MS + FINAL_FALL_MS;
      uSteps.push(withTiming(target.u, { duration: moveMs, easing: easeInOut }));
      vSteps.push(withTiming(target.v, { duration: moveMs, easing: easeInOut }));
      liftSteps.push(
        withTiming(-FINAL_HEIGHT, { duration: FINAL_RISE_MS, easing: easeOut }),
        withTiming(0, { duration: FINAL_FALL_MS, easing: easeIn }, landDone),
      );
      squashSteps.push(withTiming(1.12, { duration: FINAL_RISE_MS }), withTiming(1.04, { duration: FINAL_FALL_MS }));
    }
    // 착지: 눌렸다가(squash) 살짝 튕긴 뒤 스프링으로 멈춥니다 (timing → spring).
    liftSteps.push(withTiming(0, { duration: SQUASH_MS }), withTiming(-8, { duration: 90, easing: easeOut }), withSpring(0, motion.spring.snappy));
    squashSteps.push(withTiming(0.7, { duration: SQUASH_MS }), withSpring(1, motion.spring.bouncy));

    opacity.set(withTiming(1, { duration: 160 }));
    if (uSteps.length > 0) {
      u.set(withSequence(...uSteps));
      v.set(withSequence(...vSteps));
    }
    lift.set(withSequence(...liftSteps));
    squash.set(withSequence(...squashSteps));
  };

  return {
    pin: { u, v, lift, squash, opacity, glow, pulse, label },
    reducedMotion,
    run,
    placeAt,
    reset,
    showResult,
    hideResult,
  };
}

export type PinValues = ReturnType<typeof usePinChoreography>["pin"];
