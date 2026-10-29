import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, ZoomIn, ZoomOut } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { useReceivedInviteCount } from "@/features/invites/useReceivedInvites";
import { colors, fonts, motion, screenPadding, sizes } from "@/theme";

/** 피그마 TriPin/Top app bar — 좌 로고, 우 알림 벨. 벨 숫자 = 받은 여행 초대 수 (D15) */
export function HomeTopBar() {
  const count = useReceivedInviteCount();
  const label = count > 0 ? `받은 여행 초대 ${count}개` : "받은 여행 초대";

  // 새 초대가 오면 벨이 살짝 흔들립니다.
  const tilt = useSharedValue(0);
  useEffect(() => {
    if (count > 0) tilt.set(withSequence(withSpring(-14, motion.spring.snappy), withSpring(10, motion.spring.snappy), withSpring(0, motion.spring.gentle)));
  }, [count, tilt]);
  const bellStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.get()}deg` }] }));

  return (
    <View style={styles.bar}>
      <View style={styles.logo} accessible accessibilityRole="header" accessibilityLabel="TriPin">
        <Icons.LogoPin width={23} height={28} />
        <AppText variant="logo">TriPin</AppText>
      </View>
      <PressableScale onPress={() => router.push("/invites")} haptic="tick" style={styles.bell} accessibilityRole="button" accessibilityLabel={label}>
        <Animated.View style={bellStyle}>
          <Icons.Bell width={22} height={22} />
        </Animated.View>
        {count > 0 ? (
          <Animated.View entering={ZoomIn.springify()} exiting={ZoomOut.duration(150)} style={styles.badge} importantForAccessibility="no-hide-descendants">
            <AppText variant="badge" style={styles.badgeText}>
              {count > 9 ? "9+" : count}
            </AppText>
          </Animated.View>
        ) : null}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: sizes.homeAppBar, paddingHorizontal: screenPadding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { flexDirection: "row", alignItems: "center", gap: 4 },
  bell: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: "center", justifyContent: "center", marginRight: -10 },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10, lineHeight: 12 },
});
