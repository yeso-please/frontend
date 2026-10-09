import { forwardRef, useImperativeHandle } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { colors, motion, radius } from "@/theme";

import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

export type ChipTone = "preference" | "exclusion";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** preference: 피그마 Survey/Preference Tag(blue) · exclusion: Survey/Exclusion Tag(gray) */
  tone?: ChipTone;
  /** 최대 개수에 막혀 선택할 수 없는 상태. 부모가 reject 햅틱을 내므로 눌림 햅틱을 끕니다. */
  blocked?: boolean;
};

export type ChipHandle = { shake: () => void };

/** 선택형 태그. 최대 개수를 넘기려 하면 부모가 ref.shake()로 흔들어 알려 줍니다. */
export const SelectableChip = forwardRef<ChipHandle, Props>(function SelectableChip({ label, selected, onPress, tone = "preference", blocked = false }, ref) {
  const x = useSharedValue(0);
  useImperativeHandle(ref, () => ({
    shake: () => {
      x.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 60 }),
        withTiming(-4, { duration: 60 }),
        withSpring(0, motion.spring.snappy),
      );
    },
  }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const pref = tone === "preference";
  const containerStyle = selected
    ? pref
      ? { backgroundColor: colors.paleblue, borderColor: colors.blue, borderWidth: 1.5 }
      : { backgroundColor: colors.border, borderColor: colors.muted, borderWidth: 1.5 }
    : { backgroundColor: pref ? colors.white : colors.surface, borderColor: colors.border, borderWidth: 1 };

  return (
    <Animated.View style={shakeStyle}>
      <PressableScale
        onPress={onPress}
        haptic={blocked ? false : "tick"}
        scaleTo={0.94}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label}
        style={[styles.chip, containerStyle]}
      >
        {selected && (pref ? <Icons.CheckTag width={16} height={16} /> : <Icons.CheckExclusion width={16} height={16} />)}
        <AppText variant="body" color={selected && pref ? "blue" : "charcoal"}>
          {label}
        </AppText>
      </PressableScale>
    </Animated.View>
  );
});

/** 피그마 TriPin/Tag — mint 배경 정보성 태그 (#바다 #카페) */
export function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <AppText variant="caption" color="darkgreen">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tag: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.mint,
    justifyContent: "center",
  },
});
