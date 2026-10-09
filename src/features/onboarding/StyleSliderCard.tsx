import { useEffect, useState } from "react";
import { StyleSheet, View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { TravelStyleQuestion } from "@/api/types";
import { AppText } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { colors, fonts, motion, radius, shadows, space } from "@/theme";

import { onboardingTokens } from "./tokens";

const KNOB = onboardingTokens.knobSize;

type Props = {
  question: TravelStyleQuestion;
  value: number;
  onChange: (value: number) => void;
};

/**
 * 피그마 온보딩 7점 슬라이더 카드 (340×118, mint, r12).
 * 노브를 끌면 손가락을 따라오다가 놓으면 가장 가까운 칸으로 스프링 스냅, 점을 탭해도 선택됩니다.
 * 칸이 바뀔 때마다 햅틱 tick. 4(중립)가 아니면 기운 쪽 라벨이 점 + 굵은 accent 색이 됩니다.
 */
export function StyleSliderCard({ question, value, onChange }: Props) {
  const { minValue: min, maxValue: max, neutralValue: neutral, leftPole, rightPole } = question;
  const count = max - min + 1;

  const [width, setWidth] = useState(0);
  const trackWidth = useSharedValue(0);
  const x = useSharedValue(0);
  const index = useSharedValue(value - min);
  const dragging = useSharedValue(false);
  const lift = useSharedValue(0);

  // 바깥에서 값이 바뀌면(탭·접근성 조작·초기화) 노브를 해당 칸으로 옮깁니다. 드래그 중에는 손가락을 우선합니다.
  useEffect(() => {
    if (!width) return;
    const target = ((value - min) * (width - KNOB)) / (count - 1);
    index.set(value - min);
    if (!dragging.get()) x.set(withSpring(target, motion.spring.snappy));
  }, [value, width, min, count, index, dragging, x]);

  const commit = (nextIndex: number) => {
    haptics.tick();
    onChange(min + nextIndex);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onStart(() => {
      "worklet";
      dragging.set(true);
      lift.set(withSpring(1, motion.spring.snappy));
    })
    .onUpdate((e) => {
      "worklet";
      const w = trackWidth.get();
      if (!w) return;
      const stepWidth = (w - KNOB) / (count - 1);
      const nextX = Math.min(Math.max(e.x - KNOB / 2, 0), w - KNOB);
      x.set(nextX);
      const nextIndex = Math.round(nextX / stepWidth);
      if (nextIndex !== index.get()) {
        index.set(nextIndex);
        scheduleOnRN(commit, nextIndex);
      }
    })
    .onFinalize(() => {
      "worklet";
      const w = trackWidth.get();
      const stepWidth = (w - KNOB) / (count - 1);
      dragging.set(false);
      lift.set(withSpring(0, motion.spring.snappy));
      if (w) x.set(withSpring(index.get() * stepWidth, motion.spring.snappy));
    });

  const tap = Gesture.Tap().onEnd((e) => {
    "worklet";
    const w = trackWidth.get();
    if (!w) return;
    const stepWidth = (w - KNOB) / (count - 1);
    const nextIndex = Math.min(Math.max(Math.round((e.x - KNOB / 2) / stepWidth), 0), count - 1);
    x.set(withSpring(nextIndex * stepWidth, motion.spring.snappy));
    if (nextIndex !== index.get()) {
      index.set(nextIndex);
      scheduleOnRN(commit, nextIndex);
    }
  });

  const gesture = Gesture.Race(pan, tap);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: 1 + lift.value * 0.18 }],
  }));

  const lean = value < neutral ? "left" : value > neutral ? "right" : null;

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    const next = e.nativeEvent.actionName === "increment" ? Math.min(max, value + 1) : Math.max(min, value - 1);
    if (next !== value) commit(next - min);
  };

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${leftPole}와 ${rightPole} 중 나에게 가까운 쪽`}
      accessibilityValue={{ min, max, now: value, text: describe(value, neutral, leftPole, rightPole) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={onAccessibilityAction}
    >
      <View style={styles.labels}>
        <PoleLabel label={leftPole} active={lean === "left"} side="left" />
        <PoleLabel label={rightPole} active={lean === "right"} side="right" />
      </View>

      <GestureDetector gesture={gesture}>
        <View
          style={styles.scale}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            trackWidth.set(w);
            if (!width) x.set(((value - min) * (w - KNOB)) / (count - 1));
            setWidth(w);
          }}
        >
          <View style={styles.track} />
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={styles.dot} />
          ))}
          <Animated.View style={[styles.knob, knobStyle]} pointerEvents="none">
            <View style={styles.knobDot} />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

function PoleLabel({ label, active, side }: { label: string; active: boolean; side: "left" | "right" }) {
  const shown = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    shown.set(active ? withSpring(1, motion.spring.bouncy) : withTiming(0, motion.timing.fast));
  }, [active, shown]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value), transform: [{ scale: shown.value }] }));

  const dot = <Animated.View style={[styles.leanDot, dotStyle]} />;
  return (
    <View style={[styles.pole, side === "right" && styles.poleRight]}>
      {side === "left" ? dot : null}
      <AppText
        variant="label"
        numberOfLines={1}
        style={[styles.poleText, active ? styles.poleTextActive : null]}
        color={active ? "onboardingAccent" : "charcoal"}
      >
        {label}
      </AppText>
      {side === "right" ? dot : null}
    </View>
  );
}

function describe(value: number, neutral: number, left: string, right: string) {
  if (value === neutral) return "중간";
  const pole = value < neutral ? left : right;
  const gap = Math.abs(value - neutral);
  return `${pole} 쪽 ${gap === 1 ? "조금" : gap === 2 ? "꽤" : "매우"}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.mint,
    borderRadius: radius.md,
    padding: space[16],
    gap: space[16],
    ...shadows.card,
  },
  labels: { flexDirection: "row", justifyContent: "space-between", gap: space[12] },
  pole: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  poleRight: { justifyContent: "flex-end" },
  // 피그마 Medium 18 → 390 기준 Medium 16 (선택된 쪽만 Bold)
  poleText: { fontFamily: fonts.medium, flexShrink: 1 },
  poleTextActive: { fontFamily: fonts.bold },
  leanDot: {
    width: onboardingTokens.leanDot,
    height: onboardingTokens.leanDot,
    borderRadius: onboardingTokens.leanDot / 2,
    backgroundColor: colors.green,
  },
  scale: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  track: {
    position: "absolute",
    left: KNOB / 2,
    right: KNOB / 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.onboardingAccent,
  },
  dot: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: colors.white },
  knob: {
    position: "absolute",
    left: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.knob,
  },
  knobDot: {
    width: onboardingTokens.knobDot,
    height: onboardingTokens.knobDot,
    borderRadius: onboardingTokens.knobDot / 2,
    backgroundColor: colors.white,
  },
});
