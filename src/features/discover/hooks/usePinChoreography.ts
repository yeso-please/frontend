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

// 핀 연출 타이밍 (ms)
const DROP_IN_MS = 380;
const FINAL_RISE_MS = 260;
const FINAL_FALL_MS = 240;
const SQUASH_MS = 60;
/** 던진 핀이 날아가는 시간 (모은 힘이 클수록 조금 더 높이·오래) */
const FLY_MS = 640;
const FLY_MS_EXTRA = 160;

/** 처음 나타날 때 떨어지기 시작하는 높이 */
const DROP_HEIGHT = 150;
/** 마지막 낙하 전에 올라가는 높이 */
const FINAL_HEIGHT = 96;
/** 결과를 기다리며 공중에 떠 있는 높이 */
export const HOVER_HEIGHT = 110;

const easeOut = Easing.out(Easing.quad);
const easeIn = Easing.in(Easing.quad);
const easeInOut = Easing.inOut(Easing.cubic);

/** 핀 상태: 지도 위(0) · 손에 듦(1) · 날아가는 중(2) */
export const PIN_MODE = { map: 0, held: 1, flying: 2 } as const;

/**
 * B2 "핀 던지기" 연출. 모든 값은 UI 스레드의 shared value라 JS가 바빠도 끊기지 않습니다.
 * - mode: 지도 위 / 손에 듦(버튼 위에서 떨림) / 날아가는 중(손 → 지도로 포물선)
 * - u, v: 지도 위 위치(0~1) · lift: 지면에서 띄운 높이(px, 음수 = 위)
 * - holdX, holdY: 손에 든 핀 끝의 화면 좌표 · fly: 비행 진행 0~1 · power: 모은 힘 0~1
 * - squash: 세로 배율(착지 순간 눌림) · glow: 착지 후 바닥 빛 · label: 지역 라벨 팝
 * throwTo·land는 그 동작이 끝날 때 resolve되는 Promise를 돌려줍니다 (취소되면 resolve되지 않음).
 */
export function usePinChoreography() {
  const reducedMotion = useReducedMotion();
  const mode = useSharedValue<number>(PIN_MODE.map);
  const u = useSharedValue(0.5);
  const v = useSharedValue(0.5);
  const lift = useSharedValue(0);
  const squash = useSharedValue(1);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0);
  const label = useSharedValue(0);
  const holdX = useSharedValue(0);
  const holdY = useSharedValue(0);
  const fly = useSharedValue(0);
  const power = useSharedValue(0);

  const all = [mode, u, v, lift, squash, opacity, glow, label, holdX, holdY, fly, power];
  // 화면이 사라지면 진행 중인 연출을 멈춥니다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => all.forEach((sv) => cancelAnimation(sv)), []);

  const stopMotion = () => [u, v, lift, squash, fly].forEach((sv) => cancelAnimation(sv));

  /** 결과 표시: 바닥 빛이 퍼지고 라벨이 톡 튀어나옵니다. */
  const showResult = () => {
    glow.set(withTiming(1, motion.timing.base));
    label.set(withSpring(1, motion.spring.bouncy));
  };

  /** 다시 뽑기: 라벨·바닥 빛을 거둡니다. */
  const hideResult = () => {
    glow.set(withTiming(0, motion.timing.fast));
    label.set(withTiming(0, motion.timing.fast));
  };

  /** 애니메이션 없이 그 자리에 꽂아 둡니다 (화면 복원용). */
  const placeAt = (point: MapPoint) => {
    stopMotion();
    mode.set(PIN_MODE.map);
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
    opacity.set(withTiming(0, motion.timing.fast, (finished) => {
      if (finished) mode.set(PIN_MODE.map);
    }));
    hideResult();
    lift.set(0);
    squash.set(1);
    power.set(0);
  };

  /** 손에 든 핀: (x, y) 화면 자리에서 나타나 힘을 모으는 동안 떨립니다. */
  const hold = (x: number, y: number, chargeMs: number) => {
    stopMotion();
    hideResult();
    mode.set(PIN_MODE.held);
    holdX.set(x);
    holdY.set(y);
    squash.set(1);
    // 지도 위에 꽂혀 있던 핀이 손으로 순간이동해 보이지 않게, 손에서 새로 나타납니다.
    opacity.set(0);
    opacity.set(withTiming(1, { duration: 140 }));
    power.set(0);
    power.set(withTiming(1, { duration: chargeMs, easing: easeOut }));
  };

  /** 손에 든 핀을 거둡니다 (짧게 눌렀을 때). */
  const drop = () => {
    cancelAnimation(power);
    power.set(withTiming(0, motion.timing.fast));
    opacity.set(withTiming(0, motion.timing.fast, (finished) => {
      if (finished) mode.set(PIN_MODE.map);
    }));
  };

  /**
   * 손에 든 핀을 target으로 던집니다. hover면 꽂지 않고 그 위 공중에서 결과를 기다리며 둥실거립니다.
   * 동작 줄이기면 날지 않고 위에서 곧장 떨어집니다.
   */
  const throwTo = (target: MapPoint, { hover = false }: { hover?: boolean } = {}) =>
    new Promise<void>((resolve) => {
      stopMotion();
      cancelAnimation(power);
      const done = (finished?: boolean) => {
        "worklet";
        if (!finished) return;
        mode.set(PIN_MODE.map);
        if (hover) {
          lift.set(withRepeat(withSequence(withTiming(-HOVER_HEIGHT - 8, { duration: 420, easing: easeInOut }), withTiming(-HOVER_HEIGHT, { duration: 420, easing: easeInOut })), -1, false));
        } else {
          // 꽂히는 순간: 눌렸다가 살짝 튕긴 뒤 스프링으로 멈춥니다.
          lift.set(withSequence(withTiming(0, { duration: SQUASH_MS }), withTiming(-8, { duration: 90, easing: easeOut }), withSpring(0, motion.spring.snappy)));
          squash.set(withSequence(withTiming(0.7, { duration: SQUASH_MS }), withSpring(1, motion.spring.bouncy)));
        }
        scheduleOnRN(resolve);
      };
      u.set(target.u);
      v.set(target.v);
      if (reducedMotion) {
        mode.set(PIN_MODE.map);
        lift.set(-DROP_HEIGHT);
        opacity.set(1);
        lift.set(withTiming(hover ? -HOVER_HEIGHT : 0, { duration: DROP_IN_MS, easing: easeIn }, (finished) => {
          if (finished) scheduleOnRN(resolve);
        }));
        return;
      }
      lift.set(hover ? -HOVER_HEIGHT : 0);
      squash.set(1);
      opacity.set(1);
      fly.set(0);
      mode.set(PIN_MODE.flying);
      fly.set(withTiming(1, { duration: FLY_MS + FLY_MS_EXTRA * power.get(), easing: Easing.linear }, done));
    });

  /** 마지막: 높이 떠올라 target으로 날아간 뒤 꽂힙니다. 핀이 숨어 있었거나 동작 줄이기면 위에서 곧장 떨어집니다. */
  const land = (target: MapPoint) =>
    new Promise<void>((resolve) => {
      stopMotion();
      mode.set(PIN_MODE.map);
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
      liftSteps.push(withTiming(0, { duration: SQUASH_MS }), withTiming(-8, { duration: 90, easing: easeOut }), withSpring(0, motion.spring.snappy));
      squashSteps.push(withTiming(0.7, { duration: SQUASH_MS }), withSpring(1, motion.spring.bouncy));
      lift.set(withSequence(...liftSteps));
      squash.set(withSequence(...squashSteps));
    });

  return {
    pin: { mode, u, v, lift, squash, opacity, glow, label, holdX, holdY, fly, power },
    reducedMotion,
    hold,
    drop,
    throwTo,
    land,
    placeAt,
    reset,
    showResult,
    hideResult,
  };
}

export type PinValues = ReturnType<typeof usePinChoreography>["pin"];
