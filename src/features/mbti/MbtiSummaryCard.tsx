import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Icons } from "@/components/icons";
import { AppText, Button, PressableScale } from "@/components/ui";
import { useMbtiStore } from "@/store/mbti";
import { colors, fonts, radius, space } from "@/theme";

import { MBTI_IMAGES, MBTI_PROFILES } from "./profiles";
import { useMbtiHydrated } from "./useMbtiHydrated";

/** MY 탭 "여행 MBTI 검사" 카드 — 결과가 있으면 캐릭터·유형·이름, 없으면 검사 시작 */
export function MbtiSummaryCard() {
  const hydrated = useMbtiHydrated();
  const result = useMbtiStore((s) => s.result);

  if (hydrated && result) {
    const profile = MBTI_PROFILES[result.type];
    return (
      <PressableScale
        onPress={() => router.push("/my/mbti/result")}
        style={[styles.card, styles.resultCard]}
        accessibilityRole="button"
        accessibilityLabel={`나의 여행 성향 ${result.type} ${profile.name}`}
        accessibilityHint="결과 화면을 열어요"
      >
        <View style={styles.thumb}>
          <Image source={MBTI_IMAGES[result.type]} style={styles.thumbImage} contentFit="contain" />
        </View>
        <View style={styles.texts}>
          <AppText variant="caption" color="muted">
            나의 여행 성향
          </AppText>
          <View style={styles.nameRow}>
            <View style={styles.typeChip}>
              <AppText variant="caption" color="darkgreen" style={styles.typeText}>
                {result.type}
              </AppText>
            </View>
            <AppText variant="label" numberOfLines={1} style={styles.name}>
              {profile.name}
            </AppText>
          </View>
          <AppText variant="small12" color="muted" numberOfLines={1}>
            {profile.summary.join(" ")}
          </AppText>
        </View>
        <Icons.ChevronRight width={16} height={16} />
      </PressableScale>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.startHead}>
        <View style={styles.sparkCircle}>
          <Icons.Spark width={20} height={20} />
        </View>
        <View style={styles.texts}>
          <AppText variant="label">여행 MBTI 검사</AppText>
          <AppText variant="small13" color="muted">
            12개의 질문으로 나의 여행 성향을 알아봐요.
          </AppText>
        </View>
      </View>
      <Button label="검사 시작하기" variant="secondary" height={44} onPress={() => router.push("/my/mbti")} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: space[16], gap: space[16] },
  resultCard: { flexDirection: "row", alignItems: "center", gap: space[12] },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surface, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumbImage: { width: 64, height: 64 },
  texts: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  typeChip: { height: 18, paddingHorizontal: 6, borderRadius: radius.sm, backgroundColor: colors.mint, justifyContent: "center" },
  typeText: { fontFamily: fonts.bold, lineHeight: 16 },
  name: { flexShrink: 1 },
  startHead: { flexDirection: "row", alignItems: "center", gap: space[12] },
  sparkCircle: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.paleblue, alignItems: "center", justifyContent: "center" },
});
