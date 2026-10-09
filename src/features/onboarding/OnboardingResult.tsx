import { StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import type { OnboardingSubmission, Region, TravelMotive } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { shortRegionName } from "@/lib/josa";
import { colors, motion, radius, screenPadding, space } from "@/theme";

import { DENSITY_COPY } from "./motives";

type Props = {
  submission: OnboardingSubmission;
  motives: TravelMotive[];
  regions: Region[];
  nickname?: string;
};

const enter = (i: number) => FadeInDown.delay(motion.stagger * (i + 2)).springify().damping(motion.spring.gentle.damping);

/** 제출 직후 짧은 결과 공개 — 서버 profileText를 중심으로 고른 답을 한눈에 보여 줍니다 (피그마 화면 없음) */
export function OnboardingResult({ submission, motives, regions, nickname }: Props) {
  const motiveLabels = submission.travelMotives.map((code) => motives.find((m) => m.code === code)?.label).filter(Boolean);
  const density = DENSITY_COPY[submission.scheduleDensity];
  const rows: [string, string][] = [
    ["여행 동기", motiveLabels.join(" · ")],
    ["여행 속도", density ? `${density.short} · ${density.subtitle}` : submission.scheduleDensity],
    ["좋아한 여행지", regions.map((r) => shortRegionName(r.province, r.city)).join(" · ")],
    ["피하고 싶은 것", submission.excludeTags.join(" · ")],
  ].filter((row): row is [string, string] => !!row[1]);

  const statusNote =
    submission.tasteStatus === "PENDING"
      ? "추천에 취향을 반영하는 중이에요. 잠시 후 자동으로 적용돼요."
      : submission.tasteStatus === "FAILED"
        ? "취향 반영이 조금 늦어지고 있어요. 그동안 추천은 기본값으로 보여 드려요."
        : null;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View entering={ZoomIn.springify().damping(motion.spring.bouncy.damping)} style={styles.badge}>
        <Icons.PinDestination width={48} height={46} />
      </Animated.View>

      <Animated.View entering={enter(0)} style={styles.heading}>
        <AppText variant="caption" color="onboardingAccent" align="center">
          취향 분석 완료
        </AppText>
        <AppText variant="onboardingTitle" align="center" accessibilityRole="header">
          {nickname ? `${nickname}님은\n이런 여행자예요` : "이런 여행자예요"}
        </AppText>
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.profile}>
        <AppText variant="taskTitle" color="darkgreen" align="center">
          {submission.profileText || "취향이 고르게 열려 있는 여행자."}
        </AppText>
      </Animated.View>

      {rows.length ? (
        <Animated.View entering={enter(2)} style={styles.summary}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <AppText variant="small12" color="muted" style={styles.rowLabel}>
                {label}
              </AppText>
              <AppText variant="small13Medium" style={styles.rowValue}>
                {value}
              </AppText>
            </View>
          ))}
        </Animated.View>
      ) : null}

      {statusNote ? (
        <Animated.View entering={enter(3)}>
          <AppText variant="small12" color="muted" align="center">
            {statusNote}
          </AppText>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[32], paddingBottom: space[32], gap: space[24], alignItems: "stretch" },
  badge: {
    alignSelf: "center",
    width: 104,
    height: 104,
    borderRadius: radius.pill,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { gap: space[8] },
  profile: { backgroundColor: colors.mint, borderRadius: radius.lg, paddingHorizontal: space[24], paddingVertical: space[24] },
  summary: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space[16], paddingVertical: space[12], gap: space[8] },
  row: { flexDirection: "row", alignItems: "flex-start", gap: space[8] },
  rowLabel: { width: 84, paddingTop: 1 },
  rowValue: { flex: 1 },
});
