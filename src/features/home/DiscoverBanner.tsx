import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { colors, radius, space } from "@/theme";

/** 피그마 A1·A2 하단 — "새로운 여행지를 발견해볼까요? 핀 꽂으러 가기 →" (여행 탭으로) */
export function DiscoverBanner() {
  // 핀이 천천히 오르내립니다.
  const y = useSharedValue(0);
  useEffect(() => {
    y.set(withRepeat(withSequence(withTiming(-5, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })), -1));
  }, [y]);
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <PressableScale
      onPress={() => router.navigate("/(tabs)/travel")}
      scaleTo={0.98}
      style={styles.banner}
      accessibilityRole="button"
      accessibilityLabel="새로운 여행지를 발견해볼까요? 핀 꽂으러 가기"
    >
      <View style={styles.texts}>
        <AppText variant="body">새로운 여행지를 발견해볼까요?</AppText>
        <AppText variant="label" color="blue" style={styles.cta}>
          핀 꽂으러 가기 →
        </AppText>
      </View>
      <Animated.View style={pinStyle}>
        <Icons.PinDestination width={40} height={38} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    borderRadius: radius.lg,
    backgroundColor: colors.paleblue,
    paddingHorizontal: space[16],
    paddingVertical: space[16],
  },
  texts: { flex: 1, gap: 2 },
  cta: { fontSize: 17 },
});
