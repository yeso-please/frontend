import { useEffect, useState } from "react";
import { StyleSheet, View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { AppText } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { colors, motion } from "@/theme";

import { NEUTRAL_SNAP, SNAP_COUNT, SNAP_VALUES, snapToValue } from "./survey";

const KNOB = 28;
const TICK_HEIGHT = 12;
const LAST = SNAP_COUNT - 1;

type Props = {
  leftPole: string;
  rightPole: string;
  /** 1~7. 아직 답하지 않았으면 undefined (노브는 가운데에 흐리게) */
  value: number | undefined;
  onChange: (value: number) => void;
  /** 손을 뗐을 때 (탭·드래그 끝) — 부모가 다음 문항으로 넘깁니다 */
  onRelease?: () => void;
};

const indexOf = (value: number | undefined) => (value === undefined ? NEUTRAL_SNAP : Math.max(0, SNAP_VALUES.indexOf(value as (typeof SNAP_VALUES)[number])));

/**
 * 피그마 초안 TriPin/Preference slider · five snaps.
 * 회색 트랙 위 눈금 5개, 가운데(중립)에서 노브까지 blue로 채워집니다. 끌면 손가락을 따라오다 가까운 칸으로 스프링 스냅,
 * 눈금을 탭해도 선택. 칸이 바뀔 때마다 햅틱 tick. 기운 쪽 라벨이 blue가 됩니다.
 */
export function PreferenceSlider({ leftPole, rightPole, value, onChange, onRelease }: Props) {
  const answered = value !== undefined;
  const [width, setWidth] = useState(0);
  const trackWidth = useSharedValue(0);
  const x = useSharedValue(0);
  const index = useSharedValue(indexOf(value));
  const dragging = useSharedValue(false);
  const lift = useSharedValue(0);
  const shown = useSharedValue(answered ? 1 : 0);

  useEffect(() => {
    shown.set(withTiming(answered ? 1 : 0, motion.timing.base));
  }, [answered, shown]);

  // 바깥에서 값이 바뀌면(탭·접근성·초기화) 노브를 그 칸으로. 드래그 중에는 손가락을 우선합니다.
  useEffect(() => {
    if (!width) return;
    const i = indexOf(value);
    index.set(i);
    if (!dragging.get()) x.set(withSpring((i * (width - KNOB)) / LAST, motion.spring.snappy));
  }, [value, width, index, dragging, x]);

  const commit = (nextIndex: number) => {
    haptics.tick();
    onChange(snapToValue(nextIndex));
  };
  // 가운데 칸을 그대로 누르거나 끌다 놓아도 "답함"으로 칩니다
  const release = (finalIndex: number) => {
    if (value === undefined) {
      haptics.tick();
      onChange(snapToValue(finalIndex));
    }
    onRelease?.();
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
      const step = (w - KNOB) / LAST;
      const nextX = Math.min(Math.max(e.x - KNOB / 2, 0), w - KNOB);
      x.set(nextX);
      const nextIndex = Math.round(nextX / step);
      if (nextIndex !== index.get()) {
        index.set(nextIndex);
        scheduleOnRN(commit, nextIndex);
      }
    })
    .onEnd(() => {
      "worklet";
      scheduleOnRN(release, index.get());
    })
    .onFinalize(() => {
      "worklet";
      const w = trackWidth.get();
      dragging.set(false);
      lift.set(withSpring(0, motion.spring.snappy));
      if (w) x.set(withSpring((index.get() * (w - KNOB)) / LAST, motion.spring.snappy));
    });

  const tap = Gesture.Tap().onEnd((e) => {
    "worklet";
    const w = trackWidth.get();
    if (!w) return;
    const step = (w - KNOB) / LAST;
    const nextIndex = Math.min(Math.max(Math.round((e.x - KNOB / 2) / step), 0), LAST);
    x.set(withSpring(nextIndex * step, motion.spring.snappy));
    if (nextIndex !== index.get()) {
      index.set(nextIndex);
      scheduleOnRN(commit, nextIndex);
    }
    scheduleOnRN(release, nextIndex);
  });

  const gesture = Gesture.Race(pan, tap);

  // 가운데 칸 노브 중심 → 현재 노브 중심까지 채움
  const center = useDerivedValue(() => (NEUTRAL_SNAP * (trackWidth.get() - KNOB)) / LAST + KNOB / 2);
  const fillStyle = useAnimatedStyle(() => {
    const knobCenter = x.get() + KNOB / 2;
    return { left: Math.min(center.get(), knobCenter), width: Math.abs(knobCenter - center.get()), opacity: shown.get() };
  });
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { scale: 1 + lift.get() * 0.16 }],
    borderColor: interpolateColor(shown.get(), [0, 1], [colors.paleblue, colors.blue]),
  }));
  const knobDotStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(shown.get(), [0, 1], ["#B7CCF6", colors.blue]),
  }));

  const lean = !answered || value === 4 ? null : value < 4 ? "left" : "right";

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    const current = indexOf(value);
    const next = e.nativeEvent.actionName === "increment" ? Math.min(LAST, current + 1) : Math.max(0, current - 1);
    if (next !== current || !answered) {
      commit(next);
      onRelease?.();
    }
  };

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${leftPole}와 ${rightPole} 중 나에게 가까운 쪽`}
      accessibilityValue={{ text: describe(value, leftPole, rightPole) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={onAccessibilityAction}
    >
      <View style={styles.labels}>
        <AppText variant="small13Medium" color={lean === "left" ? "blue" : "charcoal"} numberOfLines={2} style={styles.pole}>
          {leftPole}
        </AppText>
        <AppText variant="small13Medium" color={lean === "right" ? "blue" : "charcoal"} numberOfLines={2} align="right" style={styles.pole}>
          {rightPole}
        </AppText>
      </View>

      <GestureDetector gesture={gesture}>
        <View
          style={styles.scale}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            trackWidth.set(w);
            if (!width) x.set((indexOf(value) * (w - KNOB)) / LAST);
            setWidth(w);
          }}
        >
          <View style={styles.track} />
          <View style={styles.ticks} pointerEvents="none">
            {SNAP_VALUES.map((v) => (
              <View key={v} style={styles.tickSlot}>
                <View style={styles.tick} />
              </View>
            ))}
          </View>
          <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none" />
          <Animated.View style={[styles.knob, knobStyle]} pointerEvents="none">
            <Animated.View style={[styles.knobDot, knobDotStyle]} />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

function describe(value: number | undefined, left: string, right: string) {
  if (value === undefined) return "아직 고르지 않았어요";
  if (value === 4) return "가운데, 두 취향 사이의 균형";
  const pole = value < 4 ? left : right;
  return `${pole} 쪽 ${value === 1 || value === 7 ? "매우" : "조금"}`;
}

const styles = StyleSheet.create({
  root: { gap: 18 },
  labels: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  pole: { flex: 1 },
  scale: { height: 44, justifyContent: "center" },
  track: { position: "absolute", left: KNOB / 2, right: KNOB / 2, height: 4, borderRadius: 2, backgroundColor: colors.border },
  // 눈금 5개를 노브 중심과 같은 간격으로 (양 끝 KNOB/2 안쪽)
  ticks: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between" },
  tickSlot: { width: KNOB, alignItems: "center" },
  tick: { width: 2, height: TICK_HEIGHT, borderRadius: 1, backgroundColor: "#C9D1CB" },
  fill: { position: "absolute", height: 4, borderRadius: 2, backgroundColor: colors.blue },
  knob: {
    position: "absolute",
    left: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    borderWidth: 2,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  knobDot: { width: 8, height: 8, borderRadius: 4 },
});
