import { StyleSheet, View } from "react-native";

import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { colors, radius, space } from "@/theme";

/**
 * 피그마 TriPin/Invitation/Shared preference hint.
 * 원문("모두의 취향을 반영한 코스")은 백엔드 정책(코스는 만드는 사람 취향으로 생성, 취향 합산 없음)과 달라 문구를 바꿨습니다.
 */
export function SharedPreferenceHint() {
  return (
    <View style={styles.hint}>
      <Icons.Spark width={20} height={20} />
      <AppText variant="small12" color="blue" style={styles.text}>
        {"코스는 만드는 사람의 취향으로 시작하고,\n친구도 자기 취향으로 다시 만들 수 있어요."}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: space[8],
    paddingHorizontal: space[12],
    paddingVertical: space[8],
    borderRadius: radius.md,
    backgroundColor: colors.paleblue,
  },
  text: { flex: 1 },
});
