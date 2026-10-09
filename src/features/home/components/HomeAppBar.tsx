import { StyleSheet, View } from "react-native";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { screenPadding, sizes } from "@/theme";

/** 피그마 TriPin/Top app bar — 좌 로고(핀 29×28 + "TriPin"), 우 알림 44×44 */
export function HomeAppBar({ onBellPress }: { onBellPress: () => void }) {
  return (
    <View style={styles.bar}>
      <View style={styles.logo} accessible accessibilityRole="header" accessibilityLabel="TriPin">
        <Icons.LogoPin width={29} height={28} />
        <AppText variant="logo">TriPin</AppText>
      </View>
      <PressableScale onPress={onBellPress} haptic="tick" style={styles.bell} accessibilityRole="button" accessibilityLabel="알림">
        <Icons.Bell width={22} height={22} />
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
  bell: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: "center", justifyContent: "center" },
});
