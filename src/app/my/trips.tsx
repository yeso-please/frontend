import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";

import { tripApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { TripSummary } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { formatDotRange, joinNicknames, tripCardTitle } from "@/features/trip/lib";
import { formatNights } from "@/lib/date";
import { colors, motion, radius, screenPadding, space } from "@/theme";

type Period = "UPCOMING" | "PAST";
const TABS: { value: Period; label: string }[] = [
  { value: "UPCOMING", label: "다가오는 여행" },
  { value: "PAST", label: "지난 여행" },
];

/** MY → 내 여행 전체 (3-6). 홈은 다가오는 여행만 카드로 보여 줍니다. */
export default function MyTripsScreen() {
  const [period, setPeriod] = useState<Period>("UPCOMING");
  const trips = useQuery({ queryKey: queryKeys.trips(period), queryFn: () => tripApi.list(period) });

  return (
    <Screen>
      <TopBar title="내 여행" />
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const active = tab.value === period;
          return (
            <PressableScale
              key={tab.value}
              onPress={() => setPeriod(tab.value)}
              haptic={active ? false : "tick"}
              scaleTo={0.97}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <AppText variant="small13Medium" color={active ? "charcoal" : "muted"}>
                {tab.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>

      {trips.isPending ? (
        <LoadingView />
      ) : trips.isError ? (
        <ErrorView error={trips.error} onRetry={() => void trips.refetch()} />
      ) : trips.data.length === 0 ? (
        period === "UPCOMING" ? (
          <EmptyView title="다가오는 여행이 없어요" description="여행 탭에서 핀을 꽂아 새 여행을 시작해 보세요." actionLabel="핀 꽂으러 가기" onAction={() => router.navigate("/(tabs)/travel")} />
        ) : (
          <EmptyView title="지난 여행이 없어요" description="다녀온 여행이 여기에 모여요." />
        )
      ) : (
        <Animated.View key={period} entering={FadeIn.duration(200)} style={styles.flex}>
          <FlashList
            data={trips.data}
            keyExtractor={(t) => String(t.tripId)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={trips.isRefetching} onRefresh={() => void trips.refetch()} colors={[colors.green]} />}
            renderItem={({ item, index }) => <TripRow trip={item} index={index} past={period === "PAST"} />}
          />
        </Animated.View>
      )}
    </Screen>
  );
}

function TripRow({ trip, index, past }: { trip: TripSummary; index: number; past: boolean }) {
  const title = tripCardTitle(trip.regionName, trip.title);
  const dates = `${formatDotRange(trip.startDate, trip.endDate)} · ${formatNights(trip.nights)}`;
  const people = joinNicknames(trip.participants.map((p) => p.nickname));
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * motion.stagger).springify()} layout={LinearTransition.springify()}>
      <PressableScale
        onPress={() => router.push({ pathname: "/trip/[tripId]", params: { tripId: String(trip.tripId) } })}
        scaleTo={0.98}
        style={[styles.card, past && styles.cardPast]}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${dates}, ${people}`}
      >
        <View style={styles.texts}>
          <AppText variant="label" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="small13" color="darkgreen">
            {dates}
          </AppText>
          <AppText variant="small12" color="muted" numberOfLines={1}>
            {`${people} · ${trip.hasCourse ? "코스 있음" : "코스 만들기 전"}`}
          </AppText>
        </View>
        <Icons.ChevronRight width={16} height={16} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { flexDirection: "row", marginHorizontal: screenPadding, marginTop: space[8], padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface },
  tab: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: colors.white },
  list: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[24] },
  card: { flexDirection: "row", alignItems: "center", gap: space[12], padding: space[16], borderRadius: radius.lg, backgroundColor: colors.mint, marginBottom: space[12] },
  cardPast: { backgroundColor: colors.surface },
  texts: { flex: 1, gap: 2 },
});
