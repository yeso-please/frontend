import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { toast } from "sonner-native";

import { preferencesApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { TasteMode } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { colors, motion, radius, space } from "@/theme";

import { SegmentedTabs } from "./SegmentedTabs";

type Props = {
  myNickname: string;
  regionShort: string;
  days: number;
  generating: boolean;
  /** 최초 생성은 여행을 만든 사람만 (COURSE_CREATOR_ONLY). false면 기다리는 안내만 보여 줍니다 */
  canGenerate: boolean;
  creatorNickname: string | null;
  /** 끝난 여행 — 친구 참여 안내를 뺍니다 */
  ended?: boolean;
};

const STEPS = (region: string, me: string) => [
  `${region}의 장소를 살펴보고 있어요`,
  `${me}님의 여행 성향과 맞춰 보고 있어요`,
  "하루 동선을 이어 붙이고 있어요",
  "점심·저녁 식당을 고르고 있어요",
  "코스 소개를 다듬고 있어요",
];

/** 코스를 만드는 동안 — 핀이 점선 길을 따라 통통 튀고 문구가 바뀝니다 */
function GeneratingIndicator({ region, me }: { region: string; me: string }) {
  const steps = STEPS(region, me);
  const [step, setStep] = useState(0);
  const hop = useSharedValue(0);
  const travel = useSharedValue(0);

  useEffect(() => {
    hop.set(withRepeat(withSequence(withTiming(-14, { duration: 260, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) })), -1));
    travel.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.cubic) }), -1, true));
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 2600);
    return () => {
      clearInterval(timer);
      cancelAnimation(hop);
      cancelAnimation(travel);
    };
  }, [hop, travel, steps.length]);

  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -88 + travel.get() * 176 }, { translateY: hop.get() }] }));

  return (
    <View style={styles.generating} accessibilityRole="progressbar" accessibilityLabel="코스를 만들고 있어요">
      <View style={styles.track}>
        <View style={styles.dashes}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <Animated.View style={[styles.pin, pinStyle]}>
          <Icons.PinDestination width={34} height={32} />
        </Animated.View>
      </View>
      <Animated.View key={step} entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)}>
        <AppText variant="bodyMedium15" align="center" color="darkgreen">
          {steps[step]}
        </AppText>
      </Animated.View>
      <AppText variant="small12" color="muted" align="center">
        AI가 코스 소개를 쓰느라 몇 초 걸릴 수 있어요.
      </AppText>
    </View>
  );
}

/** E0 · 첫 코스 만들기 전 — 생성 안내와 "내 여행 성향 반영 / 완전 랜덤" (코스 생성은 요청자의 이 설정을 씁니다) */
export function GenerateCourseView({ myNickname, regionShort, days, generating, canGenerate, creatorNickname, ended }: Props) {
  const queryClient = useQueryClient();
  const preferences = useQuery({ queryKey: queryKeys.preferences, queryFn: preferencesApi.get, enabled: canGenerate });
  const mode = preferences.data?.courseTasteMode ?? "TASTE";

  const changeMode = async (next: TasteMode) => {
    if (next === mode) return;
    const previous = preferences.data;
    queryClient.setQueryData(queryKeys.preferences, { courseTasteMode: next });
    try {
      queryClient.setQueryData(queryKeys.preferences, await preferencesApi.update(next));
    } catch {
      queryClient.setQueryData(queryKeys.preferences, previous);
      toast("설정을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  if (generating) return <GeneratingIndicator region={regionShort} me={myNickname} />;

  if (!canGenerate) {
    return (
      <Animated.View entering={FadeInDown.springify().damping(motion.spring.gentle.damping)} style={styles.box}>
        <AppText variant="label" color="darkgreen">
          아직 첫 코스가 없어요
        </AppText>
        <AppText variant="small13" color="darkgreen">
          {`${creatorNickname ?? "여행을 만든 사람"}님이 첫 코스를 만들면 여기에서 함께 장소를 추가·제외·교체할 수 있어요.`}
        </AppText>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.springify().damping(motion.spring.gentle.damping)} style={styles.wrap}>
      <View style={styles.box}>
        <AppText variant="label" color="darkgreen">
          {`${myNickname}님의 취향으로 첫 코스를 만들어요`}
        </AppText>
        <AppText variant="small13" color="darkgreen">
          {`${regionShort}에서 ${days}일 동안 들를 장소와 점심·저녁 식당을 순서대로 골라 드려요.${ended ? "" : " 친구들은 참여 후 장소를 추가·제외·교체할 수 있어요."}`}
        </AppText>
      </View>
      <View style={styles.modeBlock}>
        <AppText variant="small13Bold">코스 방식</AppText>
        <SegmentedTabs
          accessibilityLabel="코스 만드는 방식"
          options={[
            { value: "TASTE", label: "✓ 내 여행 성향 반영" },
            { value: "RANDOM", label: "완전 랜덤" },
          ]}
          value={mode}
          onChange={(next) => void changeMode(next)}
        />
        <AppText variant="small12" color="muted">
          {mode === "TASTE" ? "설문으로 만든 내 취향에 가까운 장소를 우선으로 뽑아요." : "취향과 상관없이 이 지역의 장소를 무작위로 골라요."}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[16] },
  box: { backgroundColor: colors.mint, borderRadius: radius.lg, padding: space[16], gap: 6 },
  modeBlock: { gap: space[8] },
  generating: { alignItems: "center", gap: space[12], paddingVertical: space[32], borderRadius: radius.lg, backgroundColor: colors.surface },
  track: { width: 220, height: 64, alignItems: "center", justifyContent: "flex-end" },
  dashes: { flexDirection: "row", gap: 8, marginBottom: 6 },
  dash: { width: 10, height: 3, borderRadius: 2, backgroundColor: colors.routeLine },
  pin: { position: "absolute", bottom: 12 },
});
