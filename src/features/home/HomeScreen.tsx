import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { inviteApi, tripApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { TripSummary } from "@/api/types";
import { AppText, Screen } from "@/components/ui";
import { InlineNotice } from "@/features/trip/components/InlineNotice";
import { Skeleton } from "@/features/trip/components/Skeleton";
import { prepStep } from "@/features/trip/prepStep";
import { useAuthStore } from "@/store/auth";
import { colors, motion, screenPadding, space } from "@/theme";

import { DiscoverBanner } from "./DiscoverBanner";
import { HomeTopBar } from "./HomeTopBar";
import { NoTripCard } from "./NoTripCard";
import { PersonaCard } from "./PersonaCard";
import { TripCarousel } from "./TripCarousel";
import { UpcomingTripCard } from "./UpcomingTripCard";
import { usePendingInviteRedirect } from "./usePendingInviteRedirect";

const enter = (i: number) => FadeInDown.delay(motion.stagger * i).springify().damping(motion.spring.gentle.damping);

/** 친구 초대 단계인지 보려면 보낸 친구 초대(4-14)가 필요한 여행 — 지역이 있고 혼자이며 코스가 아직 없는 여행 */
const needsSentInvites = (t: TripSummary) => !!t.regionSigCd && t.participants.length < 2 && !t.hasCourse;

/** 피그마 A1 · 홈 여행 준비 중 / A2 · 홈 새 여행 */
export function HomeScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [refreshing, setRefreshing] = useState(false);
  usePendingInviteRedirect();

  const trips = useQuery({ queryKey: queryKeys.trips("UPCOMING"), queryFn: () => tripApi.list("UPCOMING") });
  const waiting = (trips.data ?? []).filter(needsSentInvites);
  const sentInvites = useQueries({
    queries: waiting.map((t) => ({
      queryKey: queryKeys.friendInvites(t.tripId),
      queryFn: () => inviteApi.friendInvites(t.tripId),
      staleTime: 30_000,
    })),
  });
  const sentCount = new Map(waiting.map((t, i) => [t.tripId, sentInvites[i]?.data?.length ?? 0]));

  const stepOf = (t: TripSummary) =>
    prepStep({
      regionSigCd: t.regionSigCd,
      participantCount: t.participants.length,
      sentInviteCount: sentCount.get(t.tripId) ?? 0,
      hasCourse: t.hasCourse,
      retroactive: t.retroactive,
    });

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["trips"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.receivedInvites }),
      queryClient.invalidateQueries({ queryKey: queryKeys.myOnboarding }),
    ]);
    setRefreshing(false);
  };

  const nickname = user?.nickname ?? "여행자";

  return (
    <Screen>
      <HomeTopBar />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[colors.green]} />}
      >
        <Animated.View entering={enter(0)} style={styles.padded}>
          <AppText variant="title" accessibilityRole="header">{`${nickname}님,\n이번엔 어디로 떠나볼까요?`}</AppText>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          {trips.isPending ? (
            <View style={styles.padded}>
              <View style={styles.skeletonCard}>
                <Skeleton width="30%" height={12} />
                <Skeleton width="50%" height={24} />
                <Skeleton width="40%" height={14} />
                <Skeleton width="100%" height={52} rounded={16} />
              </View>
            </View>
          ) : trips.isError ? (
            <View style={styles.padded}>
              <InlineNotice tone="neutral" title="준비 중인 여행을 불러오지 못했어요" actionLabel="다시 시도" onAction={() => void trips.refetch()} />
            </View>
          ) : trips.data.length === 0 ? (
            <NoTripCard />
          ) : (
            <TripCarousel
              items={trips.data}
              keyOf={(t) => String(t.tripId)}
              renderItem={(t, width) => <UpcomingTripCard trip={t} step={stepOf(t)} myUserId={user?.id ?? null} width={width} />}
            />
          )}
        </Animated.View>

        <Animated.View entering={enter(2)} style={styles.padded}>
          <PersonaCard variant="home" />
        </Animated.View>

        <Animated.View entering={enter(3)} style={styles.padded}>
          <DiscoverBanner />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space[16], paddingBottom: space[32], gap: space[24] },
  padded: { paddingHorizontal: screenPadding },
  skeletonCard: { borderRadius: 20, backgroundColor: colors.surface, padding: space[16], gap: space[12] },
});
