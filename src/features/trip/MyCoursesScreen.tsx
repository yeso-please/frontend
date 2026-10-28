import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";

import { regionApi, tripApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { TripSummary } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, Button, EmptyView, ErrorView, LoadingView, PressableScale, Screen } from "@/components/ui";
import { useDiaryIdsByTrip, useStartDiary } from "@/features/diary/hooks";
import { formatDotRange, regionLabelFromName, tripCardTitle } from "@/features/trip/lib";
import { formatNights } from "@/lib/date";
import { secureImageUrl } from "@/lib/imageUrl";
import { colors, fonts, motion, radius, screenPadding, space } from "@/theme";

import { type CourseFilter, type CourseStatus, countByStatus, courseStatusOf, COURSE_FILTERS, COURSE_STATUS_LABEL, sortForCourses } from "./courseStatus";

const THUMB_W = 104;
const THUMB_H = 128;
const CARD_STALE_MS = 60 * 60_000;

/**
 * 추가 화면 01 · 내 코스 (하단 탭) — 다가오는 여행과 지난 여행(3-6)을 한 목록에 모아
 * 짜는 중(코스 전) · 완성(코스 있음) · 다녀옴(지난 여행)으로 나눠 봅니다.
 */
export function MyCoursesScreen() {
  const [filter, setFilter] = useState<CourseFilter>("ALL");
  // period를 비우면 다가오는 여행과 지난 여행을 함께 줍니다 (3-6)
  const trips = useQuery({ queryKey: queryKeys.trips(), queryFn: () => tripApi.list() });
  const diaries = useDiaryIdsByTrip();
  const startDiary = useStartDiary();

  const all = sortForCourses(trips.data ?? []);
  const counts = countByStatus(all);
  const shown = filter === "ALL" ? all : all.filter((t) => courseStatusOf(t) === filter);

  // 다녀온 여행은 여행기를 쓰거나 봅니다 (6장). 여행기 ID는 지도 핀으로 찾습니다 (3-6 myDiaryId가 아직 비어 있음).
  const openDiary = (trip: TripSummary) => {
    const diaryId = trip.myDiaryId ?? diaries.byTrip.get(trip.tripId);
    if (diaryId != null) router.push({ pathname: "/diary/[diaryId]", params: { diaryId: String(diaryId) } });
    else startDiary.mutate(trip.tripId);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="badge" color="green" style={styles.eyebrow}>
          MY TRIP
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          내 코스
        </AppText>
        <AppText variant="small13" color="muted">
          저장한 여행을 이어서 계획해 보세요
        </AppText>
      </View>

      <View style={styles.filters} accessibilityRole="tablist">
        {COURSE_FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <PressableScale
              key={f.value}
              onPress={() => setFilter(f.value)}
              haptic={active ? false : "tick"}
              scaleTo={0.96}
              style={styles.filter}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${f.label} ${counts[f.value]}개`}
            >
              <AppText variant={active ? "small13Bold" : "small13Medium"} color={active ? "charcoal" : "muted"}>
                {f.label}
              </AppText>
              <View style={[styles.count, active && styles.countActive]}>
                <AppText style={[styles.countText, { color: active ? colors.green : colors.muted }]}>{counts[f.value]}</AppText>
              </View>
              {active ? <Animated.View entering={FadeIn.duration(160)} style={styles.underline} /> : null}
            </PressableScale>
          );
        })}
      </View>

      {trips.isPending ? (
        <LoadingView />
      ) : trips.isError ? (
        <ErrorView error={trips.error} onRetry={() => void trips.refetch()} />
      ) : shown.length === 0 ? (
        <EmptyView {...EMPTY[filter]} {...(filter === "PAST" ? {} : { actionLabel: "핀 꽂으러 가기", onAction: () => router.navigate("/(tabs)/travel") })} />
      ) : (
        <Animated.View key={filter} entering={FadeIn.duration(200)} style={styles.flex}>
          <FlashList
            data={shown}
            keyExtractor={(t) => String(t.tripId)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={trips.isRefetching} onRefresh={() => void trips.refetch()} colors={[colors.green]} />}
            extraData={`${diaries.byTrip.size}-${startDiary.variables ?? ""}`}
            renderItem={({ item, index }) => (
              <CourseCard
                trip={item}
                index={index}
                status={courseStatusOf(item)}
                hasDiary={item.myDiaryId != null || diaries.byTrip.has(item.tripId)}
                diaryLoading={startDiary.isPending && startDiary.variables === item.tripId}
                onDiary={() => openDiary(item)}
              />
            )}
          />
        </Animated.View>
      )}
    </Screen>
  );
}

const EMPTY: Record<CourseFilter, { title: string; description: string }> = {
  ALL: { title: "아직 여행이 없어요", description: "여행 탭에서 핀을 꽂아 첫 여행을 시작해 보세요." },
  PLANNING: { title: "짜는 중인 코스가 없어요", description: "새 여행을 시작하면 여기에서 이어서 짤 수 있어요." },
  DONE: { title: "완성한 코스가 없어요", description: "코스를 만들면 여기에 모여요." },
  PAST: { title: "다녀온 여행이 없어요", description: "여행이 끝나면 여기에서 여행기를 쓸 수 있어요." },
};

type CardProps = { trip: TripSummary; index: number; status: CourseStatus; hasDiary: boolean; diaryLoading: boolean; onDiary: () => void };

function CourseCard({ trip, index, status, hasDiary, diaryLoading, onDiary }: CardProps) {
  const card = useQuery({
    queryKey: queryKeys.regionCard(trip.regionSigCd ?? ""),
    queryFn: () => regionApi.card(trip.regionSigCd as string),
    enabled: !!trip.regionSigCd,
    staleTime: CARD_STALE_MS,
  });
  const photo = secureImageUrl(card.data?.heroImage?.url);
  // 코스가 있으면 코스 제목("강릉, 바다와 초록 사이"), 없으면 "강릉 여행"
  const title = trip.hasCourse ? trip.title : tripCardTitle(trip.regionName, trip.title);
  const region = regionLabelFromName(trip.regionName);
  const meta = [region, `${formatDotRange(trip.startDate, trip.endDate)} · ${formatNights(trip.nights)}`].filter(Boolean).join(" · ");
  const openTrip = () => router.push({ pathname: "/trip/[tripId]", params: { tripId: String(trip.tripId) } });

  const action =
    status === "PAST"
      ? { label: hasDiary ? "여행기 보기" : "여행기 쓰기", variant: "outline" as const, onPress: onDiary, loading: diaryLoading }
      : { label: status === "PLANNING" ? "이어서 짜기" : "코스 보기", variant: "secondary" as const, onPress: openTrip, loading: false };

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * motion.stagger).springify()} layout={LinearTransition.springify()}>
      <PressableScale onPress={openTrip} scaleTo={0.98} style={styles.card} accessibilityRole="button" accessibilityLabel={`${title}, ${COURSE_STATUS_LABEL[status]}, ${meta}`}>
        <View style={styles.thumb}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
          ) : (
            <Icons.PinDestination width={30} height={28} />
          )}
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <AppText variant="label" numberOfLines={2} style={styles.flex}>
              {title}
            </AppText>
            <View style={[styles.status, STATUS_STYLE[status].box]}>
              <AppText numberOfLines={1} style={[styles.statusText, STATUS_STYLE[status].text]}>
                {COURSE_STATUS_LABEL[status]}
              </AppText>
            </View>
          </View>
          <AppText variant="small12" color="muted" numberOfLines={1}>
            {meta}
          </AppText>
          <View style={styles.chips}>
            {trip.hasCourse ? <Chip label="AI 추천 코스" tone="green" /> : null}
            {trip.participants.length > 1 ? <Chip label={`${trip.participants.length}명이 함께`} tone="blue" /> : null}
            {trip.retroactive ? <Chip label="지난 여행 기록" tone="green" /> : null}
          </View>
          <Button label={action.label} variant={action.variant} height={40} loading={action.loading} onPress={action.onPress} style={styles.action} />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function Chip({ label, tone }: { label: string; tone: "green" | "blue" }) {
  return (
    <View style={[styles.chip, { backgroundColor: tone === "green" ? colors.mint : colors.paleblue }]}>
      <AppText numberOfLines={1} style={[styles.chipText, { color: tone === "green" ? colors.darkgreen : colors.blue }]}>
        {label}
      </AppText>
    </View>
  );
}

// 피그마: 짜는 중 = 회색, 완성 = 민트, 다녀옴 = 진한 칩
const STATUS_STYLE: Record<CourseStatus, { box: { backgroundColor: string }; text: { color: string } }> = {
  PLANNING: { box: { backgroundColor: colors.surface }, text: { color: colors.muted } },
  DONE: { box: { backgroundColor: colors.mint }, text: { color: colors.darkgreen } },
  PAST: { box: { backgroundColor: colors.charcoal }, text: { color: colors.white } },
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: screenPadding, paddingTop: space[24], paddingBottom: space[16], gap: 2 },
  eyebrow: { fontFamily: fonts.bold, letterSpacing: 1.3 },
  filters: { flexDirection: "row", paddingHorizontal: space[16], borderBottomWidth: 1, borderBottomColor: colors.border },
  filter: { flex: 1, height: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[4] },
  count: { minWidth: 18, height: 18, paddingHorizontal: space[4], borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  countActive: { backgroundColor: colors.mint },
  countText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 14 },
  underline: { position: "absolute", left: space[8], right: space[8], bottom: -1, height: 2, borderRadius: 3, backgroundColor: colors.green },
  list: { paddingHorizontal: space[16], paddingTop: space[16], paddingBottom: space[24] },
  card: {
    flexDirection: "row",
    gap: space[12],
    padding: 10,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  thumb: { width: THUMB_W, height: THUMB_H, borderRadius: 10, overflow: "hidden", backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: space[4] },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: space[4] },
  status: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  statusText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[4], minHeight: 4 },
  chip: { flexShrink: 0, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  chipText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 14 },
  action: { marginTop: "auto" },
});
