import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import { colors, radius } from "@/theme";

import { AVATAR_SIZE } from "../constants";

type Props = {
  name: string;
  /** 피그마 Invitation/Avatar — mint(함께하는 중) / paleblue(응답 대기) */
  tone?: "mint" | "paleblue";
  size?: number;
  /** 겹쳐 놓을 때 테두리 */
  ring?: boolean;
};

/** 닉네임 첫 글자 원형 아바타 (profileImage는 서버가 아직 항상 null) */
export function Avatar({ name, tone = "mint", size = AVATAR_SIZE, ring }: Props) {
  const initial = Array.from(name.trim())[0] ?? "?";
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, backgroundColor: tone === "mint" ? colors.mint : colors.paleblue },
        ring && styles.ring,
      ]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <AppText variant="label" color={tone === "mint" ? "darkgreen" : "blue"}>
        {initial}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  ring: { borderWidth: 2, borderColor: colors.white },
});
