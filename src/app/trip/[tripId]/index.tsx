import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { BackHandler, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { tripApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { Icons } from "@/components/icons";
import { AppText, Button, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { Avatar } from "@/features/trip/components/Avatar";
import { RegionTag } from "@/features/trip/components/RegionTag";
import { Skeleton } from "@/features/trip/components/Skeleton";
import { useRegionLabel } from "@/features/trip/hooks/useRegionLabel";
import { formatNights, formatRange } from "@/lib/date";
import { useAuthStore } from "@/store/auth";
import { useTripDraft } from "@/store/tripDraft";
import { colors, motion, radius, screenPadding, sizes, space } from "@/theme";

/** 홈 탭으로 돌아가면서 이번 준비 상태를 비웁니다. */
function goHome() {
  router.dismissTo("/");
  useTripDraft.getState().reset();
}

/**
 * 여행 홈 (/trip/[tripId]) — 피그마 미디자인. 코스 화면이 디자인되기 전까지 여행 기본 정보와 함께하는 사람만 보여줍니다.
 */
export default function TripHomeScreen() {
  const params = useLocalSearchParams<{ tripId: string }>();
  const tripId = Number(params.tripId);
  const valid = Number.isInteger(tripId) && tripId > 0;
  const me = useAuthStore((s) => s.user);

  const context = useQuery({ queryKey: queryKeys.tripContext(tripId), queryFn: () => tripApi.context(tripId), enabled: valid });
  const participants = useQuery({ queryKey: queryKeys.participants(tripId), queryFn: () => tripApi.participants(tripId), enabled: valid });
  const regionLabel = useRegionLabel(context.data?.regionSigCd);

  // 안드로이드 뒤로 가기도 준비 화면들이 아니라 홈 탭으로 보냅니다.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goHome();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  const topTitle = regionLabel ? `${regionLabel} 여행` : "여행";

  if (!valid || (context.isError && isApiError(context.error, "TRIP_NOT_FOUND"))) {
    return (
      <Screen>
        <TopBar title="여행" onBack={goHome} />
        <EmptyView title="여행을 찾을 수 없어요" description="이미 나간 여행이거나 없는 여행이에요." actionLabel="홈으로 가기" onAction={goHome} />
      </Screen>
    );
  }
  if (context.isError) {
    return (
      <Screen>
        <TopBar title="여행" onBack={goHome} />
        <ErrorView error={context.error} onRetry={() => void context.refetch()} />
      </Screen>
    );
  }
  if (context.isPending) {
    return (
      <Screen>
        <TopBar title="여행" onBack={goHome} />
        <LoadingView label="여행을 불러오는 중이에요" />
      </Screen>
    );
  }

  const trip = context.data;
  const dateLine = `${formatRange(trip.startDate, trip.endDate)} · ${formatNights(trip.nights)}`;
  const people = [...(participants.data ?? [])].sort((a, b) => (a.userId === me?.id ? -1 : b.userId === me?.id ? 1 : 0));

  return (
    <Screen>
      <TopBar title={topTitle} onBack={goHome} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.springify()} style={styles.intro}>
          {regionLabel ? <RegionTag name={regionLabel} /> : null}
          <AppText variant="title">{regionLabel ? `${regionLabel} 여행` : "새로운 여행"}</AppText>
          <View style={styles.dates} accessible accessibilityLabel={`여행 날짜 ${dateLine}`}>
            <Icons.Calendar18 width={18} height={18} />
            <AppText variant="caption" color="darkgreen">
              {dateLine}
            </AppText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="label" accessibilityRole="header">
              {participants.isSuccess ? `함께하는 여행자  ${people.length}` : "함께하는 여행자"}
            </AppText>
            <PressableScale
              onPress={() => router.push({ pathname: "/trip/[tripId]/invite", params: { tripId: String(tripId) } })}
              style={styles.link}
              accessibilityRole="button"
            >
              <AppText variant="caption" color="blue">
                친구 초대
              </AppText>
            </PressableScale>
          </View>
          {participants.isPending ? (
            <Skeleton width={120} height={40} rounded={20} />
          ) : participants.isError ? (
            <PressableScale onPress={() => void participants.refetch()} accessibilityRole="button" style={styles.link}>
              <AppText variant="small12" color="muted">
                여행자 목록을 불러오지 못했어요 · 다시 시도
              </AppText>
            </PressableScale>
          ) : (
            <View style={styles.avatars} accessible accessibilityLabel={`함께하는 여행자: ${people.map((p) => p.nickname).join(", ")}`}>
              {people.map((p, i) => (
                <View key={p.userId} style={[styles.avatarSlot, { zIndex: people.length - i }]}>
                  <Avatar name={p.nickname} tone={i % 2 === 0 ? "mint" : "paleblue"} ring />
                </View>
              ))}
              <AppText variant="small13" color="muted" style={styles.names} numberOfLines={1}>
                {people.map((p) => (p.userId === me?.id ? "나" : p.nickname)).join(", ")}
              </AppText>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(2 * motion.stagger).springify()} style={styles.courseCard}>
          <View style={styles.courseTitle}>
            <Icons.Spark width={20} height={20} />
            <AppText variant="cardTitle">AI 코스 만들기</AppText>
          </View>
          <AppText variant="body" color="charcoal">
            {regionLabel ? `${regionLabel}의 관광지로 내 취향에 맞는 코스를 만들어요.` : "여행지의 관광지로 내 취향에 맞는 코스를 만들어요."}
          </AppText>
          <AppText variant="small12" color="muted">
            코스 화면은 디자인이 준비되면 열려요.
          </AppText>
          <Button label="AI 코스 만들기" disabled height={sizes.touchTarget + 4} style={styles.courseButton} accessibilityHint="코스 화면은 아직 준비 중이에요" />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[32], gap: space[24] },
  intro: { gap: space[8] },
  dates: { flexDirection: "row", alignItems: "center", gap: space[8] },
  section: { gap: space[8] },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: sizes.touchTarget },
  link: { minHeight: sizes.touchTarget, justifyContent: "center" },
  avatars: { flexDirection: "row", alignItems: "center" },
  avatarSlot: { marginRight: -space[8] },
  names: { flex: 1, marginLeft: space[16] },
  courseCard: { padding: space[16], gap: space[8], borderRadius: radius.lg, backgroundColor: colors.paleblue },
  courseTitle: { flexDirection: "row", alignItems: "center", gap: space[8] },
  courseButton: { marginTop: space[8] },
});
