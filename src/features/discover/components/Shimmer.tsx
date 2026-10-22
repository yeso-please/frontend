import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { colors, radius as radii } from "@/theme";

type Props = { width: number; height: number; radius?: number };

const HIGHLIGHT = [`${colors.white}00`, `${colors.white}B3`, `${colors.white}00`] as const;

/** 카드 내용을 불러오는 동안의 자리 표시. 흰 빛이 왼쪽 → 오른쪽으로 지나갑니다 (translateX 반복). */
export function ShimmerBlock({ width, height, radius = radii.sm }: Props) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(x);
  }, [x]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -width + x.value * width * 2 }] }));

  return (
    <View style={[styles.block, { width, height, borderRadius: radius }]}>
      <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
        <LinearGradient colors={HIGHLIGHT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.border, overflow: "hidden" },
});
