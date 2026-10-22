import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

import { AppText, PressableScale } from "@/components/ui";
import { colors, motion, radius, shadows } from "@/theme";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

/** 피그마 "전체 보기 / 변경 표시" 세그먼트 — 흰 칸이 스프링으로 미끄러집니다 */
export function SegmentedTabs<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width > 0 ? (width - 8) / options.length : 0;
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(index * segment, motion.spring.snappy) }] }), [index, segment]);

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {segment > 0 ? <Animated.View style={[styles.thumb, { width: segment }, thumb]} /> : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            style={styles.option}
            scaleTo={0.97}
            haptic={selected ? false : "tick"}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
          >
            <AppText variant={selected ? "small13Bold" : "small13"} color={selected ? "charcoal" : "muted"}>
              {option.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.lg, padding: 4, height: 48 },
  thumb: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: radius.md, backgroundColor: colors.white, ...shadows.card },
  option: { flex: 1, alignItems: "center", justifyContent: "center" },
});
