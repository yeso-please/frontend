import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Icons } from "@/components/icons";
import { AppText, Button } from "@/components/ui";
import { colors, screenPadding, space } from "@/theme";

/** 피그마 A2 · 홈 "새 여행" — 준비 중인 여행이 없을 때 */
export function NoTripCard() {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <AppText variant="cardTitle" style={styles.title} accessibilityRole="header">
          {"아직 준비 중인\n여행이 없어요."}
        </AppText>
        <AppText variant="small13" color="darkgreen">
          우연이 데려다줄 첫 여행을 시작해보세요.
        </AppText>
        <Button
          label="새 여행 시작하기"
          onPress={() => router.navigate("/(tabs)/travel")}
          rightIcon={<Icons.ArrowRight width={20} height={20} />}
          style={styles.cta}
          accessibilityHint="여행 탭에서 핀을 꽂아 여행지를 정해요"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: screenPadding },
  card: { backgroundColor: colors.mint, borderRadius: 20, padding: space[16], paddingTop: space[24], gap: space[8] },
  title: { fontSize: 22, lineHeight: 32 },
  cta: { marginTop: space[16] },
});
