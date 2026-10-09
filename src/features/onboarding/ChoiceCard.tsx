import { forwardRef, useEffect, useImperativeHandle, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { AppText, PressableScale } from "@/components/ui";
import { colors, fonts, motion, radius, space } from "@/theme";

import { onboardingTokens } from "./tokens";

type Props = {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  selected: boolean;
  onPress: () => void;
  /** 다중 선택(checkbox) / 단일 선택(radio) */
  role?: "checkbox" | "radio";
};

export type ChoiceCardHandle = { shake: () => void };

/**
 * 피그마 온보딩 여행 동기 카드 (358×89 → 342폭). 기본 white + 1px #C1C6D7, 선택 시 green으로 채워집니다.
 * 색은 interpolateColor로 부드럽게 바뀌고, 최대 개수를 넘기면 부모가 ref.shake()로 흔듭니다.
 * 햅틱은 선택 성공/거절에 따라 부모가 직접 줍니다.
 */
export const ChoiceCard = forwardRef<ChoiceCardHandle, Props>(function ChoiceCard({ title, subtitle, icon, selected, onPress, role = "checkbox" }, ref) {
  const progress = useSharedValue(selected ? 1 : 0);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(selected ? 1 : 0, motion.timing.base));
  }, [selected, progress]);

  useImperativeHandle(
    ref,
    () => ({
      shake: () => {
        shakeX.set(
          withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 60 }), withTiming(-5, { duration: 60 }), withSpring(0, motion.spring.snappy)),
        );
      },
    }),
    [shakeX],
  );

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.white, colors.green]),
    borderColor: interpolateColor(progress.value, [0, 1], [colors.onboardingCardBorder, colors.green]),
  }));
  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.onboardingIconCircle, onboardingTokens.selectedIconCircle]),
    // 선택이 바뀌는 동안만 살짝 부풀었다가 돌아옵니다
    transform: [{ scale: 1 + 0.08 * Math.sin(progress.value * Math.PI) }],
  }));

  return (
    <Animated.View style={shakeStyle}>
      <PressableScale
        onPress={onPress}
        haptic={false}
        scaleTo={0.97}
        accessibilityRole={role}
        accessibilityState={{ checked: selected }}
        accessibilityLabel={title}
        accessibilityHint={subtitle}
      >
        <Animated.View style={[styles.card, cardStyle]}>
          <Animated.View style={[styles.circle, circleStyle]}>{icon}</Animated.View>
          <View style={styles.texts}>
            <AppText variant="label" style={styles.title} numberOfLines={1}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="small12" numberOfLines={2}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    minHeight: 80,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space[16] + 4,
    paddingVertical: space[12],
    flexDirection: "row",
    alignItems: "center",
    gap: space[16] + 4,
  },
  circle: {
    width: onboardingTokens.iconCircle,
    height: onboardingTokens.iconCircle,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, gap: 2 },
  // 피그마 Medium 18/28 → 390 기준 Medium 16/24
  title: { fontFamily: fonts.medium },
});
