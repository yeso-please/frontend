import { useState } from "react";
import { type EntryAnimationsValues, type ExitAnimationsValues, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { motion } from "@/theme";

export type StepDirection = 1 | -1;

/**
 * 단계 화면 가로 슬라이드 (앞으로 = 오른쪽에서 들어오고 왼쪽으로 나감, 뒤로 = 반대).
 * 나가는 화면의 방향은 언마운트 순간에 정해져야 해서 방향을 shared value에 두고
 * entering/exiting 워클릿이 실행될 때 읽습니다. 사용법: `<Animated.View key={step} entering={entering} exiting={exiting}>`
 */
export function useStepTransition() {
  const direction = useSharedValue<StepDirection>(1);
  // 첫 화면은 화면 전환 애니메이션과 겹치지 않도록 슬라이드 없이 보여 줍니다.
  const [armed, setArmed] = useState(false);

  const entering = (values: EntryAnimationsValues) => {
    "worklet";
    const d = direction.get();
    return {
      initialValues: { opacity: 0, transform: [{ translateX: d * values.windowWidth }] },
      animations: {
        opacity: withTiming(1, motion.timing.base),
        transform: [{ translateX: withSpring(0, motion.spring.gentle) }],
      },
    };
  };

  const exiting = (values: ExitAnimationsValues) => {
    "worklet";
    const d = direction.get();
    return {
      initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
      animations: {
        opacity: withTiming(0, motion.timing.base),
        transform: [{ translateX: withTiming(-d * values.windowWidth * 0.6, motion.timing.base) }],
      },
    };
  };

  /** 상태를 바꾸기 직전에 부릅니다 */
  const go = (d: StepDirection) => {
    direction.set(d);
    if (!armed) setArmed(true);
  };

  return { entering: armed ? entering : undefined, exiting, go };
}

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
