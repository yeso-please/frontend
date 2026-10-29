import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { colors, motion, radius } from "@/theme";

/** 이만큼 눌러야 "꾹"으로 봅니다. 그보다 짧으면 안내만 합니다. */
export const HOLD_MIN_MS = 220;

type Props = {
  label: string;
  /** 누르는 동안 문구 */
  holdingLabel: string;
  holding: boolean;
  /** 모은 힘 0~1 (버튼 안 게이지) */
  power: SharedValue<number>;
  /** 꾹 누름이 시작될 때 (힘 모으기 시작) */
  onHoldStart: () => void;
  /** 손을 뗐을 때 (던지기) */
  onRelease: () => void;
  /** 너무 짧게 눌렀을 때 */
  onShortPress: () => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * 핀 꽂기 버튼 (피그마 primary 46). 꾹 누르면 힘이 모이고(게이지·진동), 떼는 순간 핀이 날아갑니다.
 * 화면 읽기 도구에서는 두 번 탭으로 바로 던집니다.
 */
export function HoldToThrowButton({ label, holdingLabel, holding, power, onHoldStart, onRelease, onShortPress, height = 46, style, accessibilityHint }: Props) {
  const pressed = useSharedValue(0);
  const nudge = useSharedValue(0);
  /** 꾹 누름이 시작됐는지 (손을 뗄 때 던질지 안내할지 가릅니다) */
  const activated = useSharedValue(false);

  const start = () => {
    activated.set(true);
    onHoldStart();
  };

  const finish = (success: boolean) => {
    pressed.set(withTiming(0, motion.timing.fast));
    if (activated.get()) {
      activated.set(false);
      // 시스템이 제스처를 취소해도(앱 전환 등) 모은 힘으로 그대로 던집니다.
      onRelease();
    } else if (!success) {
      haptics.reject();
      nudge.set(withSequence(withTiming(-6, { duration: 50 }), withTiming(6, { duration: 70 }), withTiming(-3, { duration: 60 }), withSpring(0, motion.spring.snappy)));
      onShortPress();
    }
  };

  const gesture = Gesture.LongPress()
    .minDuration(HOLD_MIN_MS)
    .maxDistance(4000)
    .shouldCancelWhenOutside(false)
    .runOnJS(true)
    .onBegin(() => {
      pressed.set(withTiming(1, { duration: 90 }));
      haptics.tap();
    })
    .onStart(() => start())
    .onFinalize((_e, success) => finish(success));

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value }, { scale: 1 - 0.035 * pressed.value }],
  }));
  const gaugeStyle = useAnimatedStyle(() => ({ width: `${Math.round(power.value * 100)}%` }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.base, { height }, bodyStyle, style]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName !== "activate") return;
          start();
          setTimeout(onRelease, 700);
        }}
      >
        <Animated.View style={[styles.gauge, gaugeStyle]} />
        <View style={styles.row}>
          <Icons.PinButton width={21} height={21} />
          <AppText variant="label" color="charcoal" numberOfLines={1}>
            {holding ? holdingLabel : label}
          </AppText>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  // 모은 힘 게이지: 왼쪽부터 밝게 차오릅니다.
  gauge: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.32)" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
