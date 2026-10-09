import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { motion } from "@/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** 눌렸을 때 줄어드는 비율 (기본 0.96) */
  scaleTo?: number;
  /** 눌림 햅틱. 기본 tap */
  haptic?: keyof typeof haptics | false;
};

/** 눌림에 스프링으로 살짝 줄어드는 Pressable. 앱의 모든 탭 가능한 카드·버튼의 기본입니다. */
export function PressableScale({ style, scaleTo = motion.pressScale, haptic = "tap", onPressIn, onPressOut, onPress, disabled, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, motion.spring.snappy));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, motion.spring.snappy));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) haptics[haptic]();
        onPress?.(e);
      }}
      style={[style, animatedStyle]}
    />
  );
}
