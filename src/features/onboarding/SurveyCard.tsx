import { forwardRef, useEffect, useImperativeHandle, type ReactNode } from "react";
import { StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { FadeInDown, interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { colors, motion, radius, space } from "@/theme";

/** 지금 답할 카드(active)만 blue 테두리, 아직 차례가 아닌 카드(upcoming)는 흐리게 — 피그마 초안 C1a "현재 질문 집중" */
export type CardState = "active" | "answered" | "upcoming";

export type SurveyCardHandle = { shake: () => void };

type Props = {
  state: CardState;
  children: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** 처음 화면에 들어올 때 아래에서 떠오르는 지연 (화면 첫 카드 몇 개만) */
  enterDelay?: number;
};

const opacityOf = (state: CardState) => (state === "upcoming" ? 0.45 : 1);

export const SurveyCard = forwardRef<SurveyCardHandle, Props>(function SurveyCard({ state, children, onLayout, enterDelay }, ref) {
  const focus = useSharedValue(state === "active" ? 1 : 0);
  const opacity = useSharedValue(opacityOf(state));
  const shakeX = useSharedValue(0);

  useEffect(() => {
    focus.set(withTiming(state === "active" ? 1 : 0, motion.timing.base));
    opacity.set(withTiming(opacityOf(state), motion.timing.base));
  }, [state, focus, opacity]);

  useImperativeHandle(
    ref,
    () => ({
      shake: () => {
        shakeX.set(
          withSequence(withTiming(-9, { duration: 50 }), withTiming(9, { duration: 60 }), withTiming(-6, { duration: 60 }), withSpring(0, motion.spring.snappy)),
        );
      },
    }),
    [shakeX],
  );

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    borderColor: interpolateColor(focus.get(), [0, 1], [colors.border, colors.blue]),
    transform: [{ translateX: shakeX.get() }],
  }));

  return (
    // 진입 애니메이션(바깥)과 상태 애니메이션(안쪽)이 같은 opacity·transform을 두고 다투지 않게 나눕니다
    <Animated.View onLayout={onLayout} entering={enterDelay === undefined ? undefined : FadeInDown.delay(enterDelay).springify().damping(motion.spring.gentle.damping)}>
      <Animated.View style={[styles.card, style]}>{children}</Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space[16],
    paddingTop: space[16] + 4,
    paddingBottom: space[24],
    gap: space[24],
  },
});
