import { StyleSheet, View } from "react-native";

import type { Course } from "@/api/types";
import { AppText } from "@/components/ui";
import { colors, radius, space } from "@/theme";

/** 피그마 E1 "수정님의 취향 기반 코스" 민트 상자 — 추천 방식·AI 소개 */
export function TasteBasisBox({ course }: { course: Course }) {
  const basis = course.tasteBasis?.nickname;
  const mode = course.recommendationMode;
  const heading =
    mode === "RANDOM" ? "완전 랜덤 코스" : basis ? `${basis}님의 취향 기반 코스` : mode === "TOUR_OFFICIAL" ? "관광공사 추천 코스 기반" : "추천 코스";
  const fallbackBody =
    mode === "RANDOM"
      ? "취향과 상관없이 이 지역의 장소를 무작위로 골랐어요."
      : mode === "TOUR_OFFICIAL"
        ? "관광공사 추천 코스를 바탕으로 첫 코스를 만들었어요."
        : mode === "RULE_BASED"
          ? "취향 정보를 아직 쓸 수 없어 기본 규칙으로 첫 코스를 만들었어요."
          : basis
            ? `${basis}님의 여행 성향을 기준으로 첫 코스를 만들었어요.`
            : "여행 성향을 기준으로 첫 코스를 만들었어요.";

  return (
    <View style={styles.box}>
      <View style={styles.headRow}>
        <AppText variant="label" color="darkgreen" style={styles.heading}>
          {heading}
        </AppText>
        {course.aiGenerated ? (
          <View style={styles.aiBadge}>
            <AppText variant="badge" color="blue">
              AI가 작성
            </AppText>
          </View>
        ) : null}
      </View>
      {course.title ? (
        <AppText variant="bold14" color="charcoal">
          {course.title}
        </AppText>
      ) : null}
      <AppText variant="small13" color="darkgreen">
        {course.intro ?? fallbackBody}
      </AppText>
      <AppText variant="small12" color="darkgreen" style={styles.hint}>
        친구들은 참여 후 장소를 추가·제외·교체할 수 있어요.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.mint, borderRadius: radius.lg, padding: space[16], gap: 6 },
  headRow: { flexDirection: "row", alignItems: "center", gap: space[8] },
  heading: { flexShrink: 1 },
  aiBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: colors.paleblue },
  hint: { marginTop: 2 },
});
