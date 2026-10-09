import { type ReactNode, useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { colors, radius, sizes } from "@/theme";

import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

export type ButtonVariant = "primary" | "secondary" | "neutral" | "outline" | "ghost";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** 피그마 TriPin/Button Style=Loading — 아이콘이 돌고 누를 수 없습니다 */
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  height?: number;
  /** 변형 기본 글자색 대신 쓸 색 (예: 홈 시트 "다시 뽑기"는 neutral 배경 + darkgreen 글자) */
  labelColor?: keyof typeof colors;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const palette: Record<ButtonVariant, { bg: string; fg: keyof typeof colors; border?: string }> = {
  // 피그마: green 버튼 위 텍스트는 charcoal
  primary: { bg: colors.green, fg: "charcoal" },
  secondary: { bg: colors.mint, fg: "darkgreen" },
  neutral: { bg: colors.border, fg: "charcoal" },
  outline: { bg: colors.white, fg: "charcoal", border: colors.border },
  ghost: { bg: "transparent", fg: "muted" },
};

function Spinner() {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotation);
  }, [rotation]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icons.Refresh width={20} height={20} />
    </Animated.View>
  );
}

export function Button({ label, onPress, variant = "primary", loading, disabled, leftIcon, rightIcon, height = sizes.ctaHeight, labelColor, style, accessibilityHint }: Props) {
  const p = palette[loading ? "secondary" : variant];
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      haptic={inactive ? false : "tap"}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[
        styles.base,
        { height, backgroundColor: p.bg, borderColor: p.border ?? "transparent", borderWidth: p.border ? 1 : 0 },
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <Spinner /> : leftIcon}
        <AppText variant="label" color={labelColor ?? p.fg} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.label}>
          {label}
        </AppText>
        {!loading && rightIcon}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" },
  label: { flexShrink: 1 },
  disabled: { opacity: 0.45 },
});
