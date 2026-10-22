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

// 핀 연출 타이밍 (ms). 서버가 뽑는 동안 들르기를 이어 가다가 결과가 오면 마지막으로 날아가 꽂힙니다.
const DROP_IN_MS = 380;
const HOP_MS = 320;
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

/**
 * B2 "핀 모드" 연출. 모든 값은 UI 스레드의 shared value라 JS가 바빠도 끊기지 않습니다.
 * - u, v: 지도 위 위치(0~1) · lift: 지면에서 띄운 높이(px, 음수 = 위)
 * - squash: 세로 배율(착지 순간 눌림) · glow/pulse: 착지 후 바닥 빛 · label: 지역 라벨 팝
 * search·land·drop은 그 동작이 끝날 때 resolve되는 Promise를 돌려줍니다 (취소되면 resolve되지 않음).
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

  // 화면이 사라지면 진행 중인 연출과 무한 반복(글로우)을 멈춥니다.
  useEffect(() => () => [u, v, lift, squash, opacity, glow, pulse, label].forEach((sv) => cancelAnimation(sv)), [u, v, lift, squash, opacity, glow, pulse, label]);

  const stopMotion = () => [u, v, lift, squash].forEach((sv) => cancelAnimation(sv));

  /** 결과 표시: 글로우·발자국이 퍼지고 라벨이 톡 튀어나옵니다. */
  const showResult = () => {
    glow.set(withTiming(1, motion.timing.base));
    cancelAnimation(pulse);
    pulse.set(0);
    if (!reducedMotion) pulse.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
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
    stopMotion();
    u.set(point.u);
    v.set(point.v);
    lift.set(0);
    squash.set(1);
    opacity.set(1);
    showResult();
  };

  /** 핀을 숨기고 처음 상태로 */
  const reset = () => {
    stopMotion();
    opacity.set(withTiming(0, motion.timing.fast));
    hideResult();
    lift.set(0);
    squash.set(1);
  };

  /** 서버가 뽑는 동안 지도 위 자리를 들릅니다. 숨어 있던 핀은 첫 자리 위에서 떨어지며 나타납니다. */
  const search = (spots: MapPoint[]) =>
    new Promise<void>((resolve) => {
      hideResult();
      if (reducedMotion || spots.length === 0) {
        resolve();
        return;
      }
      stopMotion();
      const done = (finished?: boolean) => {
        "worklet";
        if (finished) scheduleOnRN(resolve);
      };
      const uSteps: number[] = [];
      const vSteps: number[] = [];
      const liftSteps: number[] = [];
      const squashSteps: number[] = [];
      const [first, ...rest] = spots;
      const last = rest.length === 0;

      if (opacity.get() < 0.5) {
        // 첫 자리 위에서 떨어집니다.
        u.set(first.u);
        v.set(first.v);
        lift.set(-DROP_HEIGHT);
        squash.set(1.1);
        opacity.set(withTiming(1, { duration: 160 }));
        uSteps.push(withTiming(first.u, { duration: DROP_IN_MS }));
        vSteps.push(withTiming(first.v, { duration: DROP_IN_MS }));
        liftSteps.push(withTiming(0, { duration: DROP_IN_MS, easing: easeIn }, last ? done : undefined));
        squashSteps.push(withTiming(1.06, { duration: DROP_IN_MS - 80 }), withTiming(0.84, { duration: 80 }));
      } else {
        rest.unshift(first);
      }

      rest.forEach((spot, i) => {
        // 공중에서 늘어났다가 닿는 순간 눌리는 한 번의 점프
        const half = HOP_MS / 2;
        const isLast = i === rest.length - 1;
        uSteps.push(withTiming(spot.u, { duration: HOP_MS, easing: easeInOut }));
        vSteps.push(withTiming(spot.v, { duration: HOP_MS, easing: easeInOut }));
        liftSteps.push(withTiming(-HOP_HEIGHT, { duration: half, easing: easeOut }), withTiming(0, { duration: half, easing: easeIn }, isLast ? done : undefined));
        squashSteps.push(withTiming(1.08, { duration: half }), withTiming(0.84, { duration: half }));
      });

      u.set(withSequence(...uSteps));
      v.set(withSequence(...vSteps));
      lift.set(withSequence(...liftSteps));
      squash.set(withSequence(...squashSteps));
    });

  /** 마지막: 높이 떠올라 뽑힌 지역으로 날아간 뒤 꽂힙니다. 핀이 숨어 있었거나 동작 줄이기면 위에서 곧장 떨어집니다. */
  const land = (target: MapPoint) =>
    new Promise<void>((resolve) => {
      stopMotion();
      const landed = (finished?: boolean) => {
        "worklet";
        if (finished) scheduleOnRN(resolve);
      };
      const liftSteps: number[] = [];
      const squashSteps: number[] = [];

      if (reducedMotion || opacity.get() < 0.5) {
        u.set(target.u);
        v.set(target.v);
        lift.set(-DROP_HEIGHT);
        squash.set(1.1);
        opacity.set(withTiming(1, { duration: 160 }));
        liftSteps.push(withTiming(0, { duration: DROP_IN_MS, easing: easeIn }, landed));
        squashSteps.push(withTiming(1.04, { duration: DROP_IN_MS }));
      } else {
        const moveMs = FINAL_RISE_MS + FINAL_FALL_MS;
        u.set(withTiming(target.u, { duration: moveMs, easing: easeInOut }));
        v.set(withTiming(target.v, { duration: moveMs, easing: easeInOut }));
        liftSteps.push(
          withTiming(-FINAL_HEIGHT, { duration: FINAL_RISE_MS, easing: easeOut }),
          withTiming(0, { duration: FINAL_FALL_MS, easing: easeIn }, landed),
        );
        squashSteps.push(withTiming(1.12, { duration: FINAL_RISE_MS }), withTiming(1.04, { duration: FINAL_FALL_MS }));
      }
      // 착지: 눌렸다가(squash) 살짝 튕긴 뒤 스프링으로 멈춥니다 (timing → spring).
      liftSteps.push(withTiming(0, { duration: SQUASH_MS }), withTiming(-8, { duration: 90, easing: easeOut }), withSpring(0, motion.spring.snappy));
      squashSteps.push(withTiming(0.7, { duration: SQUASH_MS }), withSpring(1, motion.spring.bouncy));
      lift.set(withSequence(...liftSteps));
      squash.set(withSequence(...squashSteps));
    });

  return {
    pin: { u, v, lift, squash, opacity, glow, pulse, label },
    reducedMotion,
    search,
    land,
    placeAt,
    reset,
    showResult,
    hideResult,
  };
}

export type PinValues = ReturnType<typeof usePinChoreography>["pin"];
