import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { toast } from "sonner-native";

import { tripApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { TripConflict } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, BottomCTA, Button, Screen, TopBar } from "@/components/ui";
import { DateRangeSummary } from "@/features/trip/components/DateRangeSummary";
import { InlineNotice } from "@/features/trip/components/InlineNotice";
import { type DayStatus, MonthCalendar } from "@/features/trip/components/MonthCalendar";
import { NoRegionView } from "@/features/trip/components/NoRegionView";
import { SelectBox } from "@/features/trip/components/SelectBox";
import { PinIcon } from "@/features/trip/components/TintIcons";
import { DURATION_PRESETS, type DurationPreset, MAX_TRIP_DAYS, TRANSPORT_OPTIONS } from "@/features/trip/constants";
import { useRegionDayLimit } from "@/features/trip/hooks/useRegionDayLimit";
import { useStaleDraftGuard } from "@/features/trip/hooks/useStaleDraftGuard";
import { useTripCreation } from "@/features/trip/hooks/useTripCreation";
import {
  conflictsFromDetails,
  expandRanges,
  inclusiveDays,
  isSaturday,
  monthEndOf,
  monthIdOf,
  nextSaturday,
  rangeHitsBlocked,
  shiftMonth,
} from "@/features/trip/lib";
import { addDays, diffDays, formatNights, formatRange, todayYmd } from "@/lib/date";
import { haptics } from "@/lib/haptics";
import { shortRegionName, withEunNeun } from "@/lib/josa";
import { useAuthStore } from "@/store/auth";
import { useTripDraft } from "@/store/tripDraft";
import { colors, motion, screenPadding, space } from "@/theme";

/** 앞으로 몇 달까지 넘겨 볼 수 있는지 */
const MONTHS_AHEAD = 12;

/** 피그마 C · 날짜 선택 (400:1391) */
export default function TripDatesScreen() {
  const region = useTripDraft((s) => s.region);
  const tripId = useTripDraft((s) => s.tripId);
  const draftStart = useTripDraft((s) => s.startDate);
  const draftNights = useTripDraft((s) => s.nights);
  const transport = useTripDraft((s) => s.transport);
  const setTransport = useTripDraft((s) => s.setTransport);
  const queryClient = useQueryClient();
  const { submit, discard } = useTripCreation();
  const limit = useRegionDayLimit(region?.sigCd);
  useStaleDraftGuard();

  // 백엔드 규칙: 시작일은 내일 이후. 오늘·지난 날은 고를 수 없습니다.
  const today = todayYmd();
  const minDate = addDays(today, 1);
  const minMonth = monthIdOf(minDate);
  const maxMonth = shiftMonth(minMonth, MONTHS_AHEAD);

  const locked = tripId != null;
  // 드물게 준비 상태에 날짜가 없으면 서버 값으로 보여줍니다.
  const lockedContext = useQuery({
    queryKey: queryKeys.tripContext(tripId ?? 0),
    queryFn: () => tripApi.context(tripId as number),
    enabled: locked && !draftStart,
  });

  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  /** 시작일 없이 프리셋을 먼저 눌렀을 때 기억해 둔 박수 */
  const [pendingNights, setPendingNights] = useState<number | null>(null);
  const [month, setMonth] = useState(() => monthIdOf(draftStart ?? minDate));
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<TripConflict[]>([]);
  const [notice, setNotice] = useState<{ title: string; lines?: string[] } | null>(null);

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
        <NoRegionView />
      </Screen>
    );
  }

  const regionName = shortRegionName(region.province, region.city);
  // 이번 준비 중인 여행 자기 자신은 막지 않습니다.
  const blocked = expandRanges(unavailable.data, tripId);

  const start = locked ? (draftStart ?? lockedContext.data?.startDate ?? null) : selStart;
  const end = locked
    ? draftStart && draftNights != null
      ? addDays(draftStart, draftNights)
      : (lockedContext.data?.endDate ?? null)
    : selEnd;

  const maxDays = limit.status === "ready" ? Math.min(MAX_TRIP_DAYS, limit.maxDays) : MAX_TRIP_DAYS;
  const regionLimited = limit.status === "ready" && limit.maxDays < MAX_TRIP_DAYS;
  const limitMessage =
    maxDays <= 1 ? `${withEunNeun(regionName)} 당일 여행으로만 코스를 만들 수 있어요` : `${withEunNeun(regionName)} 최대 ${formatNights(maxDays - 1)}까지 코스를 만들 수 있어요`;

  /** 기간이 왜 안 되는지 (되면 null) */
  const rangeProblem = (s: string, e: string) => {
    const days = inclusiveDays(s, e);
    if (days > MAX_TRIP_DAYS) return "최대 6박 7일까지 고를 수 있어요";
    if (days > maxDays) return limitMessage;
    if (rangeHitsBlocked(s, e, blocked)) return "중간에 이미 다른 여행이 있어요";
    return null;
  };

  const statusOf = (ymd: string): DayStatus => {
    if (ymd < minDate) return "past";
    if (blocked.has(ymd)) return "blocked";
    if (!locked && selStart && !selEnd && ymd >= selStart && rangeProblem(selStart, ymd)) return "overLimit";
    return "available";
  };

  const goToMonth = (next: string) => {
    if (next === month || next < minMonth || next > maxMonth) return;
    setDirection(next > month ? 1 : -1);
    setMonth(next);
  };

  const clearMessages = () => {
    setConflicts([]);
    setNotice(null);
  };

  const reject = (message: string) => {
    haptics.reject();
    toast(message);
  };

  // ── 날짜 누르기: 시작일 → 종료일 (같은 날 = 당일) ──
  const onDayPress = (ymd: string) => {
    if (locked || ymd < minDate) return;
    if (blocked.has(ymd)) return reject("이미 다른 여행이 있는 날이에요");
    clearMessages();

    if (selStart && !selEnd && ymd >= selStart) {
      const problem = rangeProblem(selStart, ymd);
      if (problem) return reject(problem);
      setSelEnd(ymd);
      haptics.tick();
      return;
    }

    setSelStart(ymd);
    setSelEnd(null);
    if (pendingNights != null) {
      const autoEnd = addDays(ymd, pendingNights);
      const problem = rangeProblem(ymd, autoEnd);
      if (problem) toast(problem);
      else setSelEnd(autoEnd);
      setPendingNights(null);
    }
    haptics.tick();
  };

  // ── 기간 프리셋 ──
  const onPresetPress = (preset: DurationPreset) => {
    if (locked) return;
    if (preset.nights + 1 > maxDays) return reject(limitMessage);
    clearMessages();

    if (preset.key === "weekend") {
      const sat = nextSaturday(minDate);
      const sun = addDays(sat, 1);
      const problem = rangeProblem(sat, sun);
      if (problem) return reject(problem === limitMessage ? problem : "이번 주말엔 이미 다른 여행이 있어요");
      setSelStart(sat);
      setSelEnd(sun);
      setPendingNights(null);
      goToMonth(monthIdOf(sat));
      haptics.tick();
      return;
    }

    if (selStart) {
      const autoEnd = addDays(selStart, preset.nights);
      const problem = rangeProblem(selStart, autoEnd);
      if (problem) return reject(problem);
      setSelEnd(autoEnd);
      setPendingNights(null);
    } else {
      setPendingNights(preset.nights);
    }
    haptics.tick();
  };

  const selectedPreset = (() => {
    const nights = start && end ? diffDays(start, end) : pendingNights;
    if (nights == null) return null;
    if (start && end && nights === 1 && isSaturday(start) && start === nextSaturday(minDate)) return "weekend";
    return DURATION_PRESETS.find((p) => p.key !== "weekend" && p.nights === nights)?.key ?? null;
  })();

  const rangeIssue = !locked && start && end ? rangeProblem(start, end) : null;
  const limitChecking = !locked && limit.status === "loading";
  const regionBlockedEntirely = limit.status === "ready" && limit.maxDays === 0;
  const canSubmit = !!start && !!end && !submitting && (locked || (!rangeIssue && !limitChecking && !regionBlockedEntirely));

  const visibleHasBlocked = [...blocked].some((d) => d.startsWith(month.slice(0, 7)));

  // ── 날짜 선택 완료 ──
  const handleSubmit = async () => {
    if (!start || !end) return;
    clearMessages();
    setSubmitting(true);
    const outcome = await submit({ startDate: start, nights: diffDays(start, end), transport, sigCd: region.sigCd });
    setSubmitting(false);

    switch (outcome.kind) {
      case "done":
        haptics.confirm();
        router.push({ pathname: "/trip/[tripId]/invite", params: { tripId: String(outcome.tripId) } });
        return;
      case "conflict":
        haptics.reject();
        setConflicts(outcome.conflicts);
        void queryClient.invalidateQueries({ queryKey: ["trips", "unavailable"] });
        return;
      case "regionNotEligible":
        haptics.reject();
        // 캐시해 둔 일수별 추첨 가능 여부가 서버와 달랐으니 다시 받습니다.
        void queryClient.invalidateQueries({ queryKey: ["regions"] });
        setNotice({
          title: `${withEunNeun(regionName)} 이 기간엔 코스를 만들기 어려워요`,
          lines: [outcome.rolledBack ? "관광지가 부족해요. 기간을 조금 줄여서 다시 골라 주세요." : "이 여행을 지우고 기간을 줄여서 다시 만들어 주세요."],
        });
        if (outcome.rolledBack) setSelEnd(null);
        return;
      case "error": {
        const e = outcome.error;
        haptics.reject();
        if (isApiError(e, "TRIP_DATE_OVERLAP")) {
          setConflicts(conflictsFromDetails(e.details));
          void queryClient.invalidateQueries({ queryKey: ["trips", "unavailable"] });
        } else if (isApiError(e, "ONBOARDING_REQUIRED")) {
          toast("취향 설문을 먼저 마쳐 주세요");
          // 라우트 가드가 온보딩 화면으로 보냅니다.
          useAuthStore.getState().setOnboardingCompleted(false);
        } else if (isApiError(e, "TRIP_INVALID_START_DATE")) {
          setSelStart(null);
          setSelEnd(null);
          setNotice({ title: "여행은 내일부터 시작할 수 있어요", lines: ["날짜가 바뀌었어요. 출발일을 다시 골라 주세요."] });
        } else if (isApiError(e, "TRIP_INVALID_NIGHTS")) {
          toast("여행 기간은 당일부터 6박 7일까지예요");
        } else if (isApiError(e, "REGION_NOT_FOUND")) {
          setNotice({ title: "여행지 정보를 찾을 수 없어요", lines: ["홈에서 핀을 다시 꽂아 주세요."] });
        } else {
          toast(errorMessage(e));
        }
        return;
      }
    }
  };

  const confirmDiscard = () => {
    if (tripId == null) return;
    const previous = { start, end };
    Alert.alert("이 여행을 지울까요?", "만든 여행을 지우고 날짜를 다시 고를 수 있어요. 함께하던 친구가 있다면 나만 빠져요.", [
      { text: "취소", style: "cancel" },
      {
        text: "지우기",
        style: "destructive",
        onPress: () => {
          discard(tripId)
            .then(() => {
              haptics.confirm();
              setSelStart(previous.start);
              setSelEnd(previous.end);
              toast("여행을 지웠어요. 날짜를 다시 골라 주세요");
            })
            .catch((e: unknown) => reject(errorMessage(e)));
        },
      },
    ]);
  };

  return (
    <Screen>
      <TopBar title="여행 준비 · 2/4" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.springify()} style={styles.intro}>
          <AppText variant="title">언제 떠날까요?</AppText>
          <AppText variant="body" color="muted">
            {"여행 날짜를 정하면\n가능한 일정에 맞춰 코스를 만들어드려요."}
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger).springify()} style={styles.presets} accessibilityRole="radiogroup" accessibilityLabel="여행 기간">
          {DURATION_PRESETS.map((preset) => (
            <SelectBox
              key={preset.key}
              label={preset.label}
              selected={selectedPreset === preset.key}
              dimmed={!locked && preset.nights + 1 > maxDays}
              locked={locked}
              silent
              onPress={() => onPresetPress(preset)}
              accessibilityHint={preset.key === "weekend" ? "다가오는 토요일부터 1박 2일로 골라요" : undefined}
            />
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(2 * motion.stagger).springify()}>
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
            readOnly={locked}
          />
        </Animated.View>

        <Animated.View layout={LinearTransition.springify().damping(motion.spring.gentle.damping)} entering={FadeInDown.delay(3 * motion.stagger).springify()} style={styles.after}>
          <DateRangeSummary start={start} end={end} />

          {locked ? (
            <InlineNotice
              tone="neutral"
              title="여행을 만든 뒤에는 날짜를 바꿀 수 없어요"
              lines={["다른 날짜로 떠나려면 이 여행을 지우고 다시 만들어 주세요."]}
              actionLabel="여행 지우고 날짜 다시 고르기"
              onAction={confirmDiscard}
            />
          ) : null}

          {conflicts.length > 0 ? (
            <InlineNotice
              title="이 기간에 이미 다른 여행이 있어요"
              lines={conflicts.map((c) => `${c.title} (${formatRange(c.startDate, c.endDate)})`)}
            />
          ) : null}

          {notice ? <InlineNotice title={notice.title} lines={notice.lines} /> : null}

          {regionBlockedEntirely ? (
            <InlineNotice
              title={`${withEunNeun(regionName)} 지금 코스를 만들 수 없어요`}
              lines={["관광지 정보가 부족해요. 홈에서 다른 지역을 골라 주세요."]}
              actionLabel="홈으로 가기"
              onAction={() => router.navigate("/")}
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

          {/* POST /trips 필수값(transport)이라 추가한 항목 — 피그마에 없어 디자이너 검토가 필요합니다. */}
          <View style={styles.transport}>
            <AppText variant="caption" color="muted">
              이동수단
            </AppText>
            <View style={styles.transportRow} accessibilityRole="radiogroup" accessibilityLabel="이동수단">
              {TRANSPORT_OPTIONS.map((option) => (
                <SelectBox
                  key={option.value}
                  label={option.label}
                  selected={transport === option.value}
                  locked={locked}
                  onPress={() => setTransport(option.value)}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <BottomCTA helper="다음은, 함께 떠날 친구를 초대해요">
        <Button
          label={locked ? "친구 초대로 이동" : submitting ? "여행을 만드는 중" : "날짜 선택 완료"}
          onPress={() => void handleSubmit()}
          loading={submitting}
          disabled={!canSubmit}
          rightIcon={<Icons.ArrowRight width={20} height={20} />}
          accessibilityHint={!start || !end ? "시작일과 종료일을 먼저 골라 주세요" : limitChecking ? "코스를 만들 수 있는 기간을 확인하고 있어요" : undefined}
        />
      </BottomCTA>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[24], gap: space[16] },
  intro: { gap: space[4] },
  presets: { flexDirection: "row", gap: space[8] },
  after: { gap: space[12] },
  helpers: { gap: space[4] },
  limitRow: { flexDirection: "row", alignItems: "center", gap: space[4] },
  flex: { flex: 1 },
  transport: { gap: space[8], marginTop: space[4] },
  transportRow: { flexDirection: "row", gap: space[8] },
});
