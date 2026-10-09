import { useEffect, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { colors, motion } from "@/theme";

type Props = {
  /** 0~1 */
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** 진행률이 바뀌면 스프링으로 늘어나는 막대 (width 대신 transform이라 60fps 유지) */
export function ProgressBar({ progress, color = colors.blue, trackColor = colors.border, height = 4, style }: Props) {
  const [width, setWidth] = useState(0);
  const value = useSharedValue(progress);

  useEffect(() => {
    value.value = withSpring(Math.max(0, Math.min(1, progress)), motion.spring.gentle);
  }, [progress, value]);

  const fill = useAnimatedStyle(() => ({
    transform: [{ translateX: -width * (1 - value.value) }],
  }));

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color, borderRadius: height / 2 }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: "hidden", width: "100%" },
});
