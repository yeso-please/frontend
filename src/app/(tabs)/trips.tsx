import { useQuery } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { RefreshControl, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { tripApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { TripSummary } from "@/api/types";
import { AppText, EmptyView, ErrorView, LoadingView, PressableScale, Screen, Tag } from "@/components/ui";
import { formatRange } from "@/lib/date";
import { colors, motion, radius, screenPadding } from "@/theme";

// "여행" 탭 — 피그마 디자인 없음(메모: 추가 예정). 내 여행 목록만 토큰에 맞춰 보여 줍니다.
export default function TripsTab() {
  const trips = useQuery({ queryKey: queryKeys.trips(), queryFn: () => tripApi.list() });

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">내 여행</AppText>
      </View>
      {trips.isPending ? (
        <LoadingView />
      ) : trips.isError ? (
        <ErrorView error={trips.error} onRetry={() => trips.refetch()} />
      ) : trips.data.length === 0 ? (
        <EmptyView title="아직 여행이 없어요" description="홈에서 핀을 꽂아 첫 여행을 시작해 보세요." actionLabel="핀 꽂으러 가기" onAction={() => router.navigate("/")} />
      ) : (
        <FlashList
          data={trips.data}
          keyExtractor={(t) => String(t.tripId)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={trips.isRefetching} onRefresh={() => trips.refetch()} colors={[colors.green]} />}
          renderItem={({ item, index }) => <TripRow trip={item} index={index} />}
        />
      )}
    </Screen>
  );
}

function TripRow({ trip, index }: { trip: TripSummary; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * motion.stagger).springify()}>
      <PressableScale style={styles.card} onPress={() => router.push({ pathname: "/trip/[tripId]", params: { tripId: String(trip.tripId) } })}>
        <AppText variant="label" numberOfLines={1}>
          {trip.title}
        </AppText>
        <AppText variant="small13" color="muted">
          {formatRange(trip.startDate, trip.endDate)} · {trip.regionName ?? "지역 미정"}
        </AppText>
        <View style={styles.tags}>
          <Tag label={`함께 ${trip.participants.length}명`} />
          {trip.hasCourse ? <Tag label="코스 있음" /> : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: screenPadding, paddingTop: 16, paddingBottom: 12 },
  list: { paddingHorizontal: screenPadding, paddingBottom: 24 },
  card: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 4,
    marginBottom: 12,
  },
  tags: { flexDirection: "row", gap: 6, marginTop: 8 },
});
