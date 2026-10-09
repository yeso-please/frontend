import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { colors, motion, radius, space } from "@/theme";

type Props = {
  letter: "A" | "B";
  text: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * 피그마 TriPin/Survey/Answer Card (400:995) — 342×112 카드 전체가 터치 영역.
 * 선택 시 paleblue 배경 + 2px blue 보더 오버레이가 페이드인되고 체크가 스프링으로 튀어나옵니다 (레이아웃 이동 없음).
 */
export function AnswerCard({ letter, text, selected, onPress }: Props) {
  const on = useSharedValue(selected ? 1 : 0);
  const pop = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, motion.timing.fast));
    pop.set(selected ? withSpring(1, motion.spring.bouncy) : withTiming(0, motion.timing.fast));
  }, [selected, on, pop]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value), transform: [{ scale: pop.value }] }));

  return (
    <PressableScale
      onPress={onPress}
      haptic="tick"
      scaleTo={0.98}
      style={styles.card}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${letter}. ${text}`}
    >
      <Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle]} />
      <AppText variant="caption" color={selected ? "blue" : "muted"} style={styles.letter}>
        {letter}
      </AppText>
      <AppText variant="label" style={styles.text}>
        {text}
      </AppText>
      <View style={styles.checkSlot}>
        <Animated.View style={checkStyle}>
          <Icons.CheckSelected width={20} height={20} />
        </Animated.View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 112,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: space[16] + 4,
    paddingVertical: space[16],
    flexDirection: "row",
    alignItems: "center",
    gap: space[16],
  },
  // 1px 기본 보더 위를 덮도록 바깥으로 1px 넓힙니다
  overlay: {
    position: "absolute",
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.blue,
    backgroundColor: colors.paleblue,
  },
  letter: { width: 20 },
  text: { flex: 1 },
  checkSlot: { width: 20, height: 20 },
});
