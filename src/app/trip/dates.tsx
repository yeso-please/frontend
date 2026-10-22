import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { toast } from "sonner-native";

import { tripApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { TripConflict } from "@/api/types";
import { AppText, BottomCTA, Button, EmptyView, Screen, TopBar } from "@/components/ui";
import { DateRangeSummary } from "@/features/trip/components/DateRangeSummary";
import { InlineNotice } from "@/features/trip/components/InlineNotice";
import { type DayStatus, MonthCalendar } from "@/features/trip/components/MonthCalendar";
import { PinIcon } from "@/features/trip/components/TintIcons";
import { MAX_TRIP_DAYS } from "@/features/trip/constants";
import { useRegionDayLimit } from "@/features/trip/hooks/useRegionDayLimit";
import { conflictsFromDetails, expandRanges, inclusiveDays, monthEndOf, monthIdOf, rangeHitsBlocked, shiftMonth } from "@/features/trip/lib";
import { addDays, diffDays, formatNights, formatRange, todayYmd } from "@/lib/date";
import { haptics } from "@/lib/haptics";
import { shortRegionName, withEunNeun } from "@/lib/josa";
import { useAuthStore } from "@/store/auth";
import { useTripDraft } from "@/store/tripDraft";
import { colors, motion, screenPadding, space } from "@/theme";

/** 앞으로 몇 달까지 넘겨 볼 수 있는지 */
const MONTHS_AHEAD = 12;

type Notice = { title: string; lines?: string[]; redraw?: boolean };

/**
 * 피그마 C7 · 날짜 선택 (여행 준비 2/4).
 * 지역 먼저 흐름(D1): 고른 지역(sigCd)으로 3-2 확인 → 3-3에 지역까지 함께 보내 여행을 한 번에 만듭니다 (이동수단은 보내지 않아 서버 기본 CAR).
 */
export default function TripDatesScreen() {
  const region = useTripDraft((s) => s.region);
  const regionSelection = useTripDraft((s) => s.regionSelection);
  const maxNights = useTripDraft((s) => s.maxNights);
  const queryClient = useQueryClient();
  // 추첨 결과에는 최대 박수가 있고, 지도·목록에서 직접 고른 지역은 일수별 추첨 가능 여부로 계산합니다.
  const limit = useRegionDayLimit(maxNights == null ? region?.sigCd : null);

  const today = todayYmd();
  const minMonth = monthIdOf(today);
  const maxMonth = shiftMonth(minMonth, MONTHS_AHEAD);

  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [month, setMonth] = useState(minMonth);
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<TripConflict[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  // 보이는 달 앞뒤 7일까지 받아 두면 달을 넘나드는 7일 이내 기간도 겹침을 확인할 수 있습니다.
  const windowFrom = addDays(month, -7);
  const windowTo = addDays(monthEndOf(month), 7);
  const unavailable = useQuery({
    queryKey: queryKeys.unavailableDates(windowFrom, windowTo),
    queryFn: () => tripApi.unavailableDates(windowFrom, windowTo),
    placeholderData: keepPreviousData,
  });

  if (!region) {
    return (
      <Screen>
        <TopBar title="여행 준비 · 2/4" />
        <EmptyView
          title="여행지를 먼저 골라 주세요"
          description="여행 탭에서 핀을 꽂거나 지역을 고르면 날짜를 정할 수 있어요."
          actionLabel="여행지 고르러 가기"
          onAction={() => router.navigate("/(tabs)/travel")}
        />
      </Screen>
    );
  }

  const regionName = shortRegionName(region.province, region.city);
  const blocked = expandRanges(unavailable.data);

  const maxDays = maxNights != null ? Math.min(MAX_TRIP_DAYS, maxNights + 1) : limit.status === "ready" ? Math.min(MAX_TRIP_DAYS, limit.maxDays) : MAX_TRIP_DAYS;
  const regionLimited = maxDays < MAX_TRIP_DAYS;
  const limitMessage =
    maxDays <= 1 ? `${withEunNeun(regionName)} 당일 여행으로만 코스를 만들 수 있어요` : `${withEunNeun(regionName)} 최대 ${formatNights(maxDays - 1)}까지 코스를 만들 수 있어요`;
  const limitChecking = maxNights == null && limit.status === "loading";
  const regionBlockedEntirely = maxDays === 0;

  /** 기간이 왜 안 되는지 (되면 null) */
  const rangeProblem = (s: string, e: string) => {
    const days = inclusiveDays(s, e);
    if (days > MAX_TRIP_DAYS) return "최대 6박 7일까지 고를 수 있어요";
    if (days > maxDays) return limitMessage;
    if (rangeHitsBlocked(s, e, blocked)) return "중간에 이미 다른 여행이 있어요";
    return null;
  };

  const statusOf = (ymd: string): DayStatus => {
    if (ymd < today) return "past";
    if (blocked.has(ymd)) return "blocked";
    if (start && !end && ymd >= start && rangeProblem(start, ymd)) return "overLimit";
    return "available";
  };

  const goToMonth = (next: string) => {
    if (next === month || next < minMonth || next > maxMonth) return;
    setDirection(next > month ? 1 : -1);
    setMonth(next);
  };

  const reject = (message: string) => {
    haptics.reject();
    toast(message);
  };

  // ── 날짜 누르기: 시작일 → 종료일 (같은 날을 한 번 더 = 당일) ──
  const onDayPress = (ymd: string) => {
    if (ymd < today) return;
    if (blocked.has(ymd)) return reject("이미 다른 여행이 있는 날이에요");
    setConflicts([]);
    setNotice(null);
    if (start && !end && ymd >= start) {
      const problem = rangeProblem(start, ymd);
      if (problem) return reject(problem);
      setEnd(ymd);
      haptics.tick();
      return;
    }
    setStart(ymd);
    setEnd(null);
    haptics.tick();
  };

  const rangeIssue = start && end ? rangeProblem(start, end) : null;
  const canSubmit = !!start && !!end && !submitting && !rangeIssue && !limitChecking && !regionBlockedEntirely;
  const visibleHasBlocked = [...blocked].some((d) => d.startsWith(month.slice(0, 7)));

  const regionShortNotice: Notice = {
    title: "이 기간엔 코스가 부족해요, 다시 뽑을까요?",
    lines: [`${withEunNeun(regionName)} 이 기간을 채울 만큼 관광지가 많지 않아요. 기간을 줄이거나 다른 지역을 뽑아 보세요.`],
    redraw: true,
  };

  // ── 날짜 선택 완료: 겹침·지역 확인(3-2) → 여행 만들기(3-3, 지역 함께 저장) ──
  const handleSubmit = async () => {
    if (!start || !end) return;
    const nights = diffDays(start, end);
    setConflicts([]);
    setNotice(null);
    setSubmitting(true);
    try {
      const check = await tripApi.check({ startDate: start, nights, sigCd: region.sigCd });
      if (!check.available) {
        haptics.reject();
        setConflicts(check.conflicts);
        void queryClient.invalidateQueries({ queryKey: ["trips", "unavailable"] });
        return;
      }
      if (check.regionEligible === false) {
        haptics.reject();
        setNotice(regionShortNotice);
        return;
      }
      const trip = await tripApi.create({ startDate: start, nights, regionSigCd: region.sigCd, regionSelection });
      queryClient.setQueryData(queryKeys.tripContext(trip.id), trip);
      void queryClient.invalidateQueries({ queryKey: ["trips"] });
      const draft = useTripDraft.getState();
      draft.setDates(start, nights);
      draft.setTripId(trip.id);
      haptics.confirm();
      router.replace({ pathname: "/trip/[tripId]/invite", params: { tripId: String(trip.id) } });
    } catch (e) {
      haptics.reject();
      if (isApiError(e, "TRIP_DATE_OVERLAP")) {
        setConflicts(conflictsFromDetails(e.details));
        void queryClient.invalidateQueries({ queryKey: ["trips", "unavailable"] });
      } else if (isApiError(e, "DRAW_REGION_NOT_ELIGIBLE")) {
        void queryClient.invalidateQueries({ queryKey: ["regions"] });
        setNotice(regionShortNotice);
      } else if (isApiError(e, "ONBOARDING_REQUIRED")) {
        toast("취향 설문을 먼저 마쳐 주세요");
        // 라우트 가드가 설문 화면으로 보냅니다.
        useAuthStore.getState().setOnboardingCompleted(false);
      } else if (isApiError(e, "TRIP_INVALID_NIGHTS")) {
        toast("여행 기간은 당일부터 6박 7일까지예요");
      } else if (isApiError(e, "REGION_NOT_FOUND")) {
        setNotice({ title: "여행지 정보를 찾을 수 없어요", lines: ["여행 탭에서 지역을 다시 골라 주세요."], redraw: true });
      } else {
        toast(errorMessage(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <TopBar title="여행 준비 · 2/4" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.springify()} style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            언제 떠날까요?
          </AppText>
          <AppText variant="body" color="muted">
            {"여행 날짜를 정하면 가능한 일정에 맞춰\n코스를 만들어요."}
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger).springify()}>
          <MonthCalendar
            monthId={month}
            direction={direction}
            canPrev={month > minMonth}
            canNext={month < maxMonth}
            onPrev={() => goToMonth(shiftMonth(month, -1))}
            onNext={() => goToMonth(shiftMonth(month, 1))}
            start={start}
            end={end}
            today={today}
            statusOf={statusOf}
            onDayPress={onDayPress}
          />
        </Animated.View>

        <Animated.View layout={LinearTransition.springify().damping(motion.spring.gentle.damping)} entering={FadeInDown.delay(2 * motion.stagger).springify()} style={styles.after}>
          <DateRangeSummary start={start} end={end} />

          {conflicts.length > 0 ? (
            <InlineNotice title="이 기간에 이미 다른 여행이 있어요" lines={conflicts.map((c) => `${c.title} (${formatRange(c.startDate, c.endDate)})`)} />
          ) : null}

          {notice ? (
            <InlineNotice
              title={notice.title}
              lines={notice.lines}
              actionLabel={notice.redraw ? "다른 지역 뽑으러 가기" : undefined}
              onAction={notice.redraw ? () => router.navigate("/(tabs)/travel") : undefined}
            />
          ) : null}

          {regionBlockedEntirely ? (
            <InlineNotice
              title={`${withEunNeun(regionName)} 지금 코스를 만들 수 없어요`}
              lines={["관광지 정보가 부족해요. 다른 지역을 골라 주세요."]}
              actionLabel="다른 지역 뽑으러 가기"
              onAction={() => router.navigate("/(tabs)/travel")}
            />
          ) : null}

          {unavailable.isError ? (
            <InlineNotice
              tone="neutral"
              title="다른 여행 일정을 불러오지 못했어요"
              lines={["겹치는 날짜는 완료를 누를 때 한 번 더 확인해요."]}
              actionLabel="다시 불러오기"
              onAction={() => void unavailable.refetch()}
            />
          ) : null}

          <View style={styles.helpers}>
            <AppText variant="small12" color="muted">
              당일부터 최대 6박 7일까지 선택할 수 있어요.
            </AppText>
            {regionLimited || rangeIssue ? (
              <View style={styles.limitRow}>
                <PinIcon color={colors.blue} size={14} />
                <AppText variant="small12" color="blue" style={styles.flex}>
                  {rangeIssue ?? limitMessage}
                </AppText>
              </View>
            ) : null}
            {limitChecking ? (
              <AppText variant="small12" color="muted">
                {`${regionName}에서 코스를 만들 수 있는 기간을 확인하고 있어요…`}
              </AppText>
            ) : null}
            {visibleHasBlocked ? (
              <AppText variant="small12" color="muted">
                줄이 그어진 날은 이미 다른 여행이 있는 날이에요.
              </AppText>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>

      <BottomCTA>
        <Button
          label={submitting ? "여행을 만드는 중" : "날짜 선택 완료"}
          onPress={() => void handleSubmit()}
          loading={submitting}
          disabled={!canSubmit}
          accessibilityHint={!start || !end ? "시작일과 종료일을 먼저 골라 주세요" : limitChecking ? "코스를 만들 수 있는 기간을 확인하고 있어요" : "여행을 만들고 친구 초대로 넘어가요"}
        />
      </BottomCTA>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[24], paddingBottom: space[24], gap: space[24] },
  intro: { gap: space[8] },
  after: { gap: space[12] },
  helpers: { gap: space[4] },
  limitRow: { flexDirection: "row", alignItems: "center", gap: space[4] },
  flex: { flex: 1 },
});
