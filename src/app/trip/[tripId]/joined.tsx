import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tripApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { Icons } from "@/components/icons";
import { AppText, Button, EmptyView, ErrorView, LoadingView, Screen, TopBar } from "@/components/ui";
import { TravelerRow, type TravelerRowModel } from "@/features/trip/components/TravelerRow";
import { TripSummaryCard } from "@/features/trip/components/TripSummaryCard";
import { useRegionLabel } from "@/features/trip/hooks/useRegionLabel";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, motion, radius, screenPadding, space } from "@/theme";

const enter = (i: number) => FadeInDown.delay(180 + motion.stagger * i).springify().damping(motion.spring.gentle.damping);

/** 피그마 D2c · 참여 완료 — 초대를 수락한 직후 */
export default function TripJoinedScreen() {
  const params = useLocalSearchParams<{ tripId: string }>();
  const tripId = Number(params.tripId);
  const valid = Number.isInteger(tripId) && tripId > 0;
  const insets = useSafeAreaInsets();
  const me = useAuthStore((s) => s.user);

  const context = useQuery({ queryKey: queryKeys.tripContext(tripId), queryFn: () => tripApi.context(tripId), enabled: valid });
  const participants = useQuery({ queryKey: queryKeys.participants(tripId), queryFn: () => tripApi.participants(tripId), enabled: valid });
  const regionLabel = useRegionLabel(context.data?.regionSigCd);

  const goCourse = () => router.replace({ pathname: "/trip/[tripId]", params: { tripId: String(tripId) } });

  if (!valid || (context.isError && isApiError(context.error, "TRIP_NOT_FOUND"))) {
    return (
      <Screen>
        <TopBar title="여행 참여 완료" />
        <EmptyView title="여행을 찾을 수 없어요" description="이미 나간 여행이거나 없는 여행이에요." actionLabel="홈으로 가기" onAction={() => router.dismissTo("/")} />
      </Screen>
    );
  }
  if (context.isError) {
    return (
      <Screen>
        <TopBar title="여행 참여 완료" />
        <ErrorView error={context.error} onRetry={() => void context.refetch()} />
      </Screen>
    );
  }
  if (context.isPending) {
    return (
      <Screen>
        <TopBar title="여행 참여 완료" />
        <LoadingView />
      </Screen>
    );
  }

  const trip = context.data;
  const tripTitle = regionLabel ? `${regionLabel} 여행` : null;
  const nickname = me?.nickname ?? "여행자";
  const rows: TravelerRowModel[] = (participants.data ?? []).map((p) => {
    const isMe = p.userId === me?.id;
    return {
      key: `u${p.userId}`,
      userId: p.userId,
      nickname: p.nickname,
      kind: "joined",
      tag: isMe ? "나" : p.isCreator ? "초대자" : undefined,
      status: isMe ? "참여 완료 · 취향 설문 완료" : "취향 설문 완료",
    };
  });
  // 초대자 → 나 → 나머지 순서
  rows.sort((a, b) => rank(a) - rank(b));

  return (
    <Screen>
      <TopBar title="여행 참여 완료" onBack={() => router.dismissTo("/")} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.springify()} style={styles.hero} accessibilityRole="header" accessible accessibilityLabel={`${nickname}님, 함께 떠나요! ${tripTitle ?? "여행"}에 참여했어요.`}>
          <Animated.View entering={ZoomIn.delay(120).springify().damping(motion.spring.bouncy.damping).stiffness(motion.spring.bouncy.stiffness)}>
            <AppText style={styles.check}>✓</AppText>
          </Animated.View>
          <AppText variant="cardTitle" color="darkgreen" align="center">{`${nickname}님, 함께 떠나요!`}</AppText>
          <AppText variant="small13" color="darkgreen" align="center">
            {`${tripTitle ?? "여행"}에 참여했어요.\n이제 친구들과 코스를 다듬을 수 있어요.`}
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(0)}>
          <TripSummaryCard title={tripTitle} startDate={trip.startDate} endDate={trip.endDate} />
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.travelers}>
          <AppText variant="taskTitle" accessibilityRole="header">
            함께하는 여행자
          </AppText>
          <View style={styles.rows}>
            {rows.map((row, i) => (
              <TravelerRow key={row.key} row={row} index={i} />
            ))}
          </View>
        </Animated.View>
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <Button label="함께 코스 보러 가기" onPress={goCourse} rightIcon={<Icons.ArrowRight width={20} height={20} />} />
      </View>
    </Screen>
  );
}

const rank = (row: TravelerRowModel) => (row.kind === "joined" && row.tag === "초대자" ? 0 : row.kind === "joined" && row.tag === "나" ? 1 : 2);

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[24], paddingBottom: space[24], gap: space[24] },
  hero: { borderRadius: radius.lg, backgroundColor: colors.mint, paddingVertical: space[24], paddingHorizontal: space[16], alignItems: "center", gap: space[8] },
  check: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 44, color: colors.green },
  travelers: { gap: space[8] },
  rows: { gap: space[4] },
  actions: { paddingTop: space[12], paddingHorizontal: screenPadding, backgroundColor: colors.white },
});
