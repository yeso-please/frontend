import { useEffect } from "react";
import { type DimensionValue, StyleSheet } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { colors, radius } from "@/theme";

type Props = { width: DimensionValue; height: number; rounded?: number };

/** 불러오는 동안 자리를 잡아 두는 회색 막대 (투명도만 천천히 깜빡입니다) */
export function Skeleton({ width, height, rounded = radius.sm }: Props) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[styles.base, { width, height, borderRadius: rounded }, pulse]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.border },
});
