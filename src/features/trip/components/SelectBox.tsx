import { useEffect } from "react";
import { type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { AppText, PressableScale } from "@/components/ui";
import { colors, motion, radius, sizes, space } from "@/theme";

type Props = {
  label: string;
  selected: boolean;
  /** 고를 수 없는 상태. 눌러도 onPress는 불리고(이유 안내용) 흐리게 보입니다. */
  dimmed?: boolean;
  /** 아예 누를 수 없음 (읽기 전용) */
  locked?: boolean;
  /** 햅틱을 부모가 결과(성공·거절)에 맞춰 직접 줄 때 */
  silent?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * 피그마 Calendar/Duration preset — Default(surface) / Selected(mint + 1px green 보더).
 * 이동수단 선택에도 같은 모양을 씁니다. 선택 층은 투명도로만 바뀝니다.
 */
export function SelectBox({ label, selected, dimmed, locked, silent, onPress, accessibilityHint, style }: Props) {
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, motion.timing.fast));
  }, [selected, on]);
  const selectedLayer = useAnimatedStyle(() => ({ opacity: on.get() }));

  return (
    <PressableScale
      onPress={onPress}
      disabled={locked}
      haptic={dimmed || silent ? false : "tick"}
      scaleTo={0.94}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled: !!dimmed || !!locked }}
      style={[styles.box, (dimmed || locked) && !selected && styles.dimmed, style]}
    >
      <Animated.View pointerEvents="none" style={[styles.selectedLayer, selectedLayer]} />
      <AppText variant="small13Medium" color={selected ? "darkgreen" : dimmed ? "muted" : "charcoal"}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    height: sizes.touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[8],
  },
  selectedLayer: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green,
    backgroundColor: colors.mint,
  },
  dimmed: { opacity: 0.5 },
});
