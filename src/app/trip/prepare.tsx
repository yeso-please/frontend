import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { toast } from "sonner-native";

import { onboardingApi, tripApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import { Icons } from "@/components/icons";
import { AppText, BottomCTA, Button, Screen, TopBar } from "@/components/ui";
import { MBTI_PROFILES } from "@/features/mbti";
import { NoRegionView } from "@/features/trip/components/NoRegionView";
import { PrepProgress } from "@/features/trip/components/PrepProgress";
import { RegionTag } from "@/features/trip/components/RegionTag";
import type { TaskState } from "@/features/trip/components/StatusBadge";
import { TaskCard } from "@/features/trip/components/TaskCard";
import { useStaleDraftGuard } from "@/features/trip/hooks/useStaleDraftGuard";
import { truncate } from "@/features/trip/lib";
import { addDays, formatNights, formatRange } from "@/lib/date";
import { haptics } from "@/lib/haptics";
import { shortRegionName, withEuro } from "@/lib/josa";
import { useMbtiStore } from "@/store/mbti";
import { useTripDraft } from "@/store/tripDraft";
import { motion, screenPadding, space } from "@/theme";

const TOTAL_STEPS = 3;

/** 피그마 A · 여행 준비 (400:1368) — 취향 설문 · 날짜 선택 · 친구 초대 3단계 진행 상황 */
export default function TripPrepareScreen() {
  const region = useTripDraft((s) => s.region);
  const tripId = useTripDraft((s) => s.tripId);
  const startDate = useTripDraft((s) => s.startDate);
  const nights = useTripDraft((s) => s.nights);
  const mbti = useMbtiStore((s) => s.result);
  useStaleDraftGuard();

  // 여행 MBTI 결과가 없을 때만 서버 설문 요약(profileText)을 보여줍니다.
  const onboarding = useQuery({ queryKey: queryKeys.myOnboarding, queryFn: onboardingApi.me, enabled: !mbti });
  // 날짜까지 정했으면 친구가 들어왔는지로 3단계 완료를 판단합니다.
  const participants = useQuery({
    queryKey: queryKeys.participants(tripId ?? 0),
    queryFn: () => tripApi.participants(tripId as number),
    enabled: tripId != null,
  });

  if (!region) {
    return (
      <Screen>
        <TopBar title="여행 준비" />
        <NoRegionView />
      </Screen>
    );
  }

  const regionName = shortRegionName(region.province, region.city);
  const datesDone = tripId != null;
  const companions = (participants.data?.length ?? 1) - 1;
  const inviteDone = datesDone && companions > 0;

  const datesState: TaskState = datesDone ? "complete" : "current";
  const inviteState: TaskState = inviteDone ? "complete" : datesDone ? "current" : "pending";
  const doneCount = 1 + (datesDone ? 1 : 0) + (inviteDone ? 1 : 0);

  // ── 01 취향 설문 ──
  const surveyLines = (() => {
    if (mbti) return { primary: `${mbti.type} · ${MBTI_PROFILES[mbti.type].name}`, secondary: "나의 여행 성향 결과 보기" };
    const profileText = onboarding.data?.submission?.profileText;
    if (profileText) return { primary: "취향 설문 완료", secondary: truncate(profileText, 20) };
    if (onboarding.isPending) return { primary: "취향 설문 완료", secondary: "취향 요약을 불러오는 중이에요" };
    return { primary: "취향 설문 완료", secondary: "나의 여행 취향 보기" };
  })();
  const openSurvey = () => router.push(mbti ? "/my/mbti/result" : "/my/taste");

  // ── 02 날짜 선택 ──
  const datesLines =
    datesDone && startDate && nights != null
      ? { primary: formatRange(startDate, addDays(startDate, nights)), secondary: `${formatNights(nights)} · ${withEuro(regionName)} 떠나요` }
      : { primary: "여행 기간을 정하면\n가능한 일정을 확인해요.", secondary: undefined };
  const openDates = () => router.push("/trip/dates");

  // ── 03 친구 초대 ──
  const inviteLines = inviteDone
    ? { primary: `${companions}명의 친구와 함께해요`, secondary: "친구 더 초대하기" }
    : // 백엔드 정책: 코스는 만드는 사람 취향으로 만들고 친구는 함께 고치거나 자기 취향으로 다시 만듭니다 (취향 합산 없음).
      { primary: "함께 떠날 친구를 초대하고\n코스를 같이 다듬어요.", secondary: undefined };
  const openInvite = () => {
    if (tripId == null) {
      haptics.reject();
      toast("여행 날짜를 먼저 정해 주세요");
      return;
    }
    router.push({ pathname: "/trip/[tripId]/invite", params: { tripId: String(tripId) } });
  };

  const next = !datesDone
    ? { label: "날짜 선택하기", hint: "이제 여행 날짜를 정해볼까요?", onPress: openDates }
    : !inviteDone
      ? { label: "친구 초대하기", hint: "이제 함께 떠날 친구를 초대해볼까요?", onPress: openInvite }
      : {
          label: "여행으로 이동",
          hint: "준비 완료! 이제 AI 코스를 만들 차례예요.",
          onPress: () => router.push({ pathname: "/trip/[tripId]", params: { tripId: String(tripId) } }),
        };

  return (
    <Screen>
      <TopBar title="여행 준비" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.springify()} style={styles.intro}>
          <AppText variant="title">여행의 시작을 준비해요</AppText>
          <AppText variant="body" color="muted">
            {"여행을 시작하기 전에\n몇 가지만 준비해볼까요?"}
          </AppText>
          <View style={styles.tagRow}>
            <RegionTag name={regionName} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger).springify()}>
          <PrepProgress done={doneCount} total={TOTAL_STEPS} hint={next.hint} onHintPress={next.onPress} />
        </Animated.View>

        <View style={styles.tasks}>
          <TaskCard
            index={2}
            step="01"
            title="취향 설문"
            kind="survey"
            state="complete"
            primary={surveyLines.primary}
            secondary={surveyLines.secondary}
            onPress={openSurvey}
            accessibilityHint={mbti ? "여행 성향 결과를 봐요" : "나의 여행 취향을 봐요"}
          />
          <TaskCard
            index={3}
            step="02"
            title="날짜 선택"
            kind="dates"
            state={datesState}
            primary={datesLines.primary}
            secondary={datesLines.secondary}
            onPress={openDates}
            accessibilityHint={datesDone ? "정한 여행 날짜를 봐요" : "여행 날짜를 고르러 가요"}
          />
          <TaskCard
            index={4}
            step="03"
            title="친구 초대"
            kind="invite"
            state={inviteState}
            primary={inviteLines.primary}
            secondary={inviteLines.secondary}
            onPress={openInvite}
            accessibilityHint={datesDone ? "함께 갈 친구를 초대해요" : "날짜를 정한 뒤에 초대할 수 있어요"}
          />
        </View>

        <Animated.View entering={FadeInDown.delay(5 * motion.stagger).springify()} style={styles.journey}>
          <Icons.Pin16 width={16} height={16} />
          <AppText variant="tiny11" color="muted">
            핀 꽂기 → AI 코스 → 함께 편집 → 공유 · 여행기
          </AppText>
        </Animated.View>
      </ScrollView>

      {/* 피그마 원문 "준비를 마치면 핀을 꽂을 수 있어요"는 핀 먼저 흐름과 맞지 않아 바꿨습니다. */}
      <BottomCTA helper="준비를 마치면 AI가 코스를 만들어요">
        <Button label={next.label} onPress={next.onPress} rightIcon={<Icons.ArrowRight width={20} height={20} />} />
      </BottomCTA>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[24], gap: space[16] },
  intro: { gap: space[4] },
  tagRow: { marginTop: space[8] },
  tasks: { gap: space[12] },
  journey: { flexDirection: "row", alignItems: "center", gap: space[4], marginTop: space[4] },
});
