import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { useReceivedInviteCount } from "@/features/invites/useReceivedInvites";
import { colors, fonts, motion, radius, screenPadding, sizes } from "@/theme";

/** 피그마 TriPin/Top app bar — 좌 로고(핀 29×28 + "TriPin"), 우 알림 44×44. 벨 숫자 = 받은 여행 초대 수 (D15) */
export function DiscoverAppBar() {
  const count = useReceivedInviteCount();
  const badge = count > 9 ? "9+" : String(count);
  return (
    <View style={styles.bar}>
      <View style={styles.logo} accessible accessibilityRole="header" accessibilityLabel="TriPin">
        <Icons.LogoPin width={23} height={28} />
        <AppText variant="logo">TriPin</AppText>
      </View>
      <PressableScale
        onPress={() => router.push("/invites")}
        haptic="tick"
        style={styles.bell}
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? `알림, 받은 여행 초대 ${count}개` : "알림"}
      >
        <Icons.Bell width={22} height={22} />
        {count > 0 ? (
          <Animated.View
            entering={ZoomIn.springify().damping(motion.spring.bouncy.damping)}
            exiting={ZoomOut.duration(140)}
            style={styles.badge}
            importantForAccessibility="no-hide-descendants"
          >
            <AppText variant="badge" color="white" style={styles.badgeText}>
              {badge}
            </AppText>
          </Animated.View>
        ) : null}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: sizes.homeAppBar,
    paddingHorizontal: screenPadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { flexDirection: "row", alignItems: "center", gap: 4 },
  bell: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: "center", justifyContent: "center", marginRight: -11 },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 12 },
});
