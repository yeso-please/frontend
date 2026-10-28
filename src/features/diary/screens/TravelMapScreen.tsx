import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { travelMapApi, tripApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { TravelMapPin, TripSummary } from "@/api/types";
import { AppText, Button, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { formatNights, formatRange } from "@/lib/date";
import { regionLabelFromName, tripCardTitle } from "@/features/trip/lib";
import { colors, motion, radius, screenPadding, space } from "@/theme";

import { TravelMapCanvas } from "../components/TravelMapCanvas";
import { visibilityLabel } from "../constants";
import { useDiaryIdsByTrip, useMyTravelMap, useStartDiary } from "../hooks";

const enter = (i: number) => FadeInDown.delay(motion.stagger * i).springify().damping(motion.spring.gentle.damping);
const openDiary = (pin: TravelMapPin) => router.push({ pathname: "/diary/[diaryId]", params: { diaryId: String(pin.diaryId) } });

/** 나의 여행 지도 (6-7) — 여행기 핀 지도 + 기록한 여행 + 아직 기록하지 않은 지난 여행 */
export function MyTravelMapScreen() {
  const map = useMyTravelMap();
  const past = useQuery({ queryKey: queryKeys.trips("PAST"), queryFn: () => tripApi.list("PAST") });
  const diaryIndex = useDiaryIdsByTrip();
  const start = useStartDiary();

  const pins = map.data ?? [];
  const unrecorded = (past.data ?? []).filter((t) => !diaryIndex.byTrip.has(t.tripId) && t.myDiaryId == null);
  const refreshing = map.isRefetching || past.isRefetching;
  const refresh = () => {
    void map.refetch();
    void past.refetch();
  };

  return (
    <Screen>
      <TopBar title="나의 여행 지도" />
      {map.isPending ? (
        <LoadingView />
      ) : map.isError ? (
        <ErrorView error={map.error} onRetry={() => void map.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.green]} />}
        >
          <Animated.View entering={enter(0)} style={styles.head}>
            <AppText variant="title" accessibilityRole="header">
              나의 여행 지도
            </AppText>
            <AppText variant="small13" color="muted">
              {pins.length > 0 ? `다녀온 여행 ${pins.length}곳` : "여행기를 쓰면 다녀온 곳이 지도에 핀으로 남아요."}
            </AppText>
          </Animated.View>

          <Animated.View entering={enter(1)}>
            <TravelMapCanvas pins={pins} onPinPress={openDiary} />
          </Animated.View>

          {unrecorded.length > 0 ? (
            <Animated.View entering={enter(2)} style={styles.section}>
              <AppText variant="label">기록할 여행</AppText>
              <AppText variant="small12" color="muted">
                끝난 여행에 사진과 이야기를 남겨 보세요. 여행기를 만들면 그 여행의 코스는 더 바꿀 수 없어요.
              </AppText>
              {unrecorded.map((trip) => (
                <UnrecordedRow key={trip.tripId} trip={trip} loading={start.isPending && start.variables === trip.tripId} onWrite={() => start.mutate(trip.tripId)} />
              ))}
            </Animated.View>
          ) : null}

          <Animated.View entering={enter(3)} style={styles.section}>
            <AppText variant="label">기록한 여행</AppText>
            {pins.length === 0 ? (
              <AppText variant="small13" color="muted">
                아직 쓴 여행기가 없어요.
              </AppText>
            ) : (
              pins.map((pin) => <DiaryRow key={pin.diaryId} pin={pin} />)
            )}
          </Animated.View>
        </ScrollView>
      )}
    </Screen>
  );
}

/** 친구 여행 지도 (6-8) — 친구가 발행한 "친구 공개" 여행기만 */
export function FriendTravelMapScreen({ userId, nickname }: { userId: number; nickname: string }) {
  const map = useQuery({ queryKey: queryKeys.friendTravelMap(userId), queryFn: () => travelMapApi.friend(userId) });
  const title = `${nickname}의 여행 지도`;

  return (
    <Screen>
      <TopBar title={title} />
      {map.isPending ? (
        <LoadingView />
      ) : map.isError ? (
        isApiError(map.error, "FRIEND_REQUIRED") ? (
          <EmptyView title="친구만 볼 수 있어요" description="서로 친구가 된 뒤에 여행 지도를 볼 수 있어요." />
        ) : (
          <ErrorView error={map.error} onRetry={() => void map.refetch()} />
        )
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={enter(0)} style={styles.head}>
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
            <AppText variant="small13" color="muted">
              {map.data.length > 0 ? `친구에게 공개한 여행 ${map.data.length}곳` : "아직 친구에게 공개한 여행기가 없어요."}
            </AppText>
          </Animated.View>
          <Animated.View entering={enter(1)}>
            <TravelMapCanvas pins={map.data} onPinPress={openDiary} />
          </Animated.View>
          <Animated.View entering={enter(2)} style={styles.section}>
            {map.data.map((pin) => (
              <DiaryRow key={pin.diaryId} pin={pin} hideVisibility />
            ))}
          </Animated.View>
        </ScrollView>
      )}
    </Screen>
  );
}

function DiaryRow({ pin, hideVisibility }: { pin: TravelMapPin; hideVisibility?: boolean }) {
  const region = regionLabelFromName(pin.regionName);
  const status = pin.status === "DRAFT" ? "초안" : hideVisibility ? null : `발행 · ${visibilityLabel(pin.visibility)}`;
  return (
    <PressableScale onPress={() => openDiary(pin)} style={styles.row} accessibilityRole="button" accessibilityLabel={`${pin.title} 여행기 열기`}>
      <View style={styles.thumb}>
        {pin.coverPhotoUrl ? (
          <Image source={{ uri: pin.coverPhotoUrl }} style={styles.thumbImage} contentFit="cover" transition={200} />
        ) : (
          <AppText variant="small13Bold" color="darkgreen">
            {region?.slice(0, 2) ?? "여행"}
          </AppText>
        )}
      </View>
      <View style={styles.rowText}>
        <AppText variant="bold14" numberOfLines={1}>
          {pin.title}
        </AppText>
        <AppText variant="small12" color="muted" numberOfLines={1}>
          {[region, pin.visitedAt.replaceAll("-", ".")].filter(Boolean).join(" · ")}
        </AppText>
        {status ? (
          <AppText variant="caption" color={pin.status === "DRAFT" ? "blue" : "darkgreen"}>
            {status}
          </AppText>
        ) : null}
      </View>
    </PressableScale>
  );
}

function UnrecordedRow({ trip, loading, onWrite }: { trip: TripSummary; loading: boolean; onWrite: () => void }) {
  return (
    <View style={styles.unrecorded}>
      <View style={styles.rowText}>
        <AppText variant="bold14" numberOfLines={1}>
          {tripCardTitle(trip.regionName, trip.title)}
        </AppText>
        <AppText variant="small12" color="muted">
          {`${formatRange(trip.startDate, trip.endDate)} · ${formatNights(trip.nights)}`}
        </AppText>
      </View>
      <Button label="여행기 쓰기" variant="secondary" height={40} loading={loading} onPress={onWrite} style={styles.writeButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingBottom: space[32], gap: space[24] },
  head: { gap: space[4], paddingTop: space[8] },
  section: { gap: space[12] },
  row: { flexDirection: "row", alignItems: "center", gap: space[12], padding: space[12], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%" },
  rowText: { flex: 1, gap: 2 },
  unrecorded: { flexDirection: "row", alignItems: "center", gap: space[12], padding: space[16], borderRadius: radius.lg, backgroundColor: colors.surface },
  writeButton: { width: 112 },
});
