import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import { colors, radius, space } from "@/theme";

import { PinIcon } from "./TintIcons";

/** 피그마 TriPin/Tag(mint) 모양에 핀 아이콘을 더한 "어디로 가는지" 표시 */
export function RegionTag({ name }: { name: string }) {
  return (
    <View style={styles.tag} accessible accessibilityLabel={`여행지 ${name}`}>
      <PinIcon color={colors.darkgreen} size={14} />
      <AppText variant="caption" color="darkgreen">
        {name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: space[4],
    height: 28,
    paddingHorizontal: space[12],
    borderRadius: radius.md,
    backgroundColor: colors.mint,
  },
});
