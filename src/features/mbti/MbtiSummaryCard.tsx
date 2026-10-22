import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { onboardingApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import { Icons } from "@/components/icons";
import { AppText, Button, PressableScale } from "@/components/ui";
import { colors, fonts, radius, space } from "@/theme";

import { MBTI_IMAGES, MBTI_PROFILES } from "./profiles";
import { isMbtiType } from "./types";

/** "나의 여행 성향" 요약 카드 — 서버 mbtiCode가 있으면 캐릭터·유형·이름, 없으면(구형 설문) 성향검사 하기 */
export function MbtiSummaryCard() {
  const onboarding = useQuery({ queryKey: queryKeys.myOnboarding, queryFn: onboardingApi.me });
  const type = onboarding.data?.submission?.mbtiCode;

  if (isMbtiType(type)) {
    const profile = MBTI_PROFILES[type];
    const result = { type };
    return (
      <PressableScale
        onPress={() => router.push("/my/persona")}
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
            <AppText variant="label" numberOfLines={2} style={styles.name}>
              {profile.name}
            </AppText>
          </View>
          <AppText variant="small12" color="muted" numberOfLines={1}>
            {profile.oneLiner}
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
          <AppText variant="label">나의 여행 성향</AppText>
          <AppText variant="small13" color="muted">
            {onboarding.isPending ? "불러오는 중이에요" : "성향검사를 하면 나에게 맞는 여행 성향을 알 수 있어요."}
          </AppText>
        </View>
      </View>
      <Button label="성향검사 하기" variant="secondary" height={44} disabled={onboarding.isPending} onPress={() => router.push("/survey")} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: space[16], gap: space[16] },
  resultCard: { flexDirection: "row", alignItems: "center", gap: space[12] },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surface, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumbImage: { width: 64, height: 64 },
  texts: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  // 긴 유형 이름("반짝이는 분위기 메이커")은 두 줄까지

  typeChip: { height: 18, marginTop: 3, paddingHorizontal: 6, borderRadius: radius.sm, backgroundColor: colors.mint, justifyContent: "center" },
  typeText: { fontFamily: fonts.bold, lineHeight: 16 },
  name: { flexShrink: 1 },
  startHead: { flexDirection: "row", alignItems: "center", gap: space[12] },
  sparkCircle: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.paleblue, alignItems: "center", justifyContent: "center" },
});
