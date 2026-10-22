import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

import { courseApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { RouteLeg, Transport } from "@/api/types";
import { AppText, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { DayTabs } from "@/features/course/components/DayTabs";
import { SegmentedTabs } from "@/features/course/components/SegmentedTabs";
import { TRANSPORT_LABEL, TRANSPORT_ORDER, tripTitle } from "@/features/course/format";
import { useCourse } from "@/features/course/useCourse";
import { KakaoMapView } from "@/features/kakaoMap";
import { formatShort } from "@/lib/date";
import { colors, motion, radius, screenPadding, space } from "@/theme";

import { buildCourseMarkers, buildRouteLines, legSummary, routePoints } from "./lib";

const MAP_HEIGHT = 320;

const SOURCE_LABEL: Record<RouteLeg["source"], string> = { ROAD: "도로 경로", WALK: "도보 경로", TRANSIT: "대중교통 경로", STRAIGHT: "직선 추정" };

/**
 * 코스 경로 지도 (5-7) — 하루 코스를 방문 순서 번호 핀과 경로 선으로 보여 줍니다.
 * 수단(도보·자동차·대중교통)을 바꾸면 그 수단으로 다시 부르고, 직선 추정 구간은 점선·"약"으로 표시합니다.
 */
export function CourseMapScreen({ tripId, initialDay }: { tripId: number; initialDay: number }) {
  const course = useCourse(tripId);
  const days = course.data?.days ?? [];
  const [dayIndex, setDayIndex] = useState(initialDay);
  /** undefined면 여행 이동수단(서버 기본) — 응답의 transport로 탭을 맞춥니다 */
  const [transport, setTransport] = useState<Transport | undefined>(undefined);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mapTouching, setMapTouching] = useState(false);
  const day = days.find((d) => d.dayIndex === dayIndex) ?? days[0];
  const activeDay = day?.dayIndex ?? 0;

  const routes = useQuery({
    queryKey: queryKeys.routes(tripId, activeDay, transport ?? "DEFAULT"),
    queryFn: () => courseApi.routes(tripId, activeDay, transport),
    enabled: !!day,
    placeholderData: keepPreviousData,
  });
  const shownTransport = transport ?? routes.data?.transport;

  // 경로를 받은 뒤 코스가 편집됐으면(버전이 다르면) 한 번 다시 받습니다.
  const refetchedFor = useRef<string | null>(null);
  useEffect(() => {
    const c = course.data?.version;
    const r = routes.data?.version;
    if (c == null || r == null || c === r || routes.isFetching) return;
    const key = `${activeDay}:${shownTransport}:${c}`;
    if (refetchedFor.current === key) return;
    refetchedFor.current = key;
    void routes.refetch();
  }, [course.data?.version, routes.data?.version, routes.isFetching, activeDay, shownTransport, routes]);

  const points = useMemo(() => (day ? routePoints(day.items) : []), [day]);
  const markers = useMemo(() => (day ? buildCourseMarkers(day.items, selectedItemId) : []), [day, selectedItemId]);
  // 이전 날의 경로가 잠깐 남아 보이지 않게, 받은 경로가 지금 날 것일 때만 선을 그립니다.
  const legs = useMemo(() => (routes.data && routes.data.dayIndex === activeDay ? routes.data.legs : []), [routes.data, activeDay]);
  const lines = useMemo(() => buildRouteLines(legs), [legs]);
  const nameOf = useMemo(() => new Map(points.map((p, i) => [p.itemId, { name: p.name, number: i + 1 }])), [points]);

  const changeDay = (next: number) => {
    setDayIndex(next);
    setSelectedItemId(null);
  };

  if (course.isPending) {
    return (
      <Screen>
        <TopBar title="코스 지도" />
        <LoadingView label="코스를 불러오는 중이에요" />
      </Screen>
    );
  }
  if (course.isError) {
    const noCourse = isApiError(course.error, "COURSE_NOT_FOUND");
    return (
      <Screen>
        <TopBar title="코스 지도" />
        {noCourse ? (
          <EmptyView title="아직 코스가 없어요" description="코스를 만들면 지도에서 동선을 볼 수 있어요." actionLabel="코스로 돌아가기" onAction={() => router.back()} />
        ) : (
          <ErrorView error={course.error} onRetry={() => course.refetch()} />
        )}
      </Screen>
    );
  }
  if (!day) {
    return (
      <Screen>
        <TopBar title="코스 지도" />
        <EmptyView title="아직 코스에 장소가 없어요" actionLabel="코스로 돌아가기" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="코스 지도" />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} scrollEnabled={!mapTouching} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.springify().damping(motion.spring.gentle.damping)} style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {course.data.title ?? tripTitle(course.data.regionName)}
          </AppText>
          <AppText variant="small13" color="muted">{`${activeDay + 1}일차 · ${formatShort(day.date)} · 장소 ${points.length}곳`}</AppText>
        </Animated.View>

        <DayTabs days={days} value={activeDay} onChange={changeDay} />
        <SegmentedTabs
          options={TRANSPORT_ORDER.map((t) => ({ value: t, label: TRANSPORT_LABEL[t] }))}
          value={shownTransport ?? "CAR"}
          onChange={setTransport}
          accessibilityLabel="이동수단"
        />

        <View>
          <KakaoMapView
            markers={markers}
            polylines={lines}
            fitKey={`${activeDay}`}
            focusId={selectedItemId}
            onMarkerPress={(id) => setSelectedItemId((prev) => (prev === id ? null : id))}
            onInteractionChange={setMapTouching}
            style={{ height: MAP_HEIGHT }}
            accessibilityLabel={`${activeDay + 1}일차 코스 지도, 장소 ${points.length}곳`}
          />
          {routes.isFetching ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.fetching} pointerEvents="none">
              <AppText variant="small12" color="darkgreen">
                경로를 불러오는 중이에요
              </AppText>
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.line, styles.lineSolid]} />
            <AppText variant="small12" color="muted">
              실제 경로
            </AppText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.line, styles.lineDashed]} />
            <AppText variant="small12" color="muted">
              직선 추정
            </AppText>
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="label" accessibilityRole="header">
            이동 구간
          </AppText>
          {routes.isError && legs.length === 0 ? (
            <AppText variant="body" color="muted">
              경로를 불러오지 못했어요. 핀 순서대로 이동해 주세요.
            </AppText>
          ) : points.length <= 1 ? (
            <AppText variant="body" color="muted">
              이날은 이동할 구간이 없어요.
            </AppText>
          ) : routes.isPending ? (
            <AppText variant="body" color="muted">
              경로를 계산하고 있어요…
            </AppText>
          ) : (
            legs.map((leg, i) => {
              const from = nameOf.get(leg.fromItemId);
              const to = nameOf.get(leg.toItemId);
              const selected = selectedItemId === leg.toItemId;
              return (
                <Animated.View key={`${leg.fromItemId}>${leg.toItemId}`} entering={FadeInDown.delay(Math.min(i, 6) * 50).springify().damping(motion.spring.gentle.damping)}>
                  <PressableScale
                    onPress={() => setSelectedItemId(leg.toItemId)}
                    haptic="tick"
                    scaleTo={0.98}
                    style={[styles.leg, selected && styles.legSelected]}
                    accessibilityLabel={`${from?.name ?? "앞 장소"}에서 ${to?.name ?? "다음 장소"}까지 ${legSummary(leg)}, ${SOURCE_LABEL[leg.source]}`}
                  >
                    <AppText variant="small13Bold" numberOfLines={2}>
                      {`${from?.number ?? "·"} ${from?.name ?? ""} → ${to?.number ?? "·"} ${to?.name ?? ""}`}
                    </AppText>
                    <View style={styles.legMeta}>
                      <AppText variant="small13" color="charcoal">
                        {legSummary(leg)}
                      </AppText>
                      <View style={[styles.badge, leg.source === "STRAIGHT" && styles.badgeMuted]}>
                        <AppText variant="badge" color={leg.source === "STRAIGHT" ? "muted" : "darkgreen"}>
                          {SOURCE_LABEL[leg.source]}
                        </AppText>
                      </View>
                    </View>
                  </PressableScale>
                </Animated.View>
              );
            })
          )}
          <AppText variant="small12" color="muted">
            경로는 카카오맵 길찾기 결과이고, 받지 못한 구간은 직선거리로 어림해요.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[32], gap: space[16] },
  intro: { gap: space[4] },
  fetching: { position: "absolute", top: space[12], alignSelf: "center", backgroundColor: colors.mint, borderRadius: radius.pill, paddingHorizontal: space[12], paddingVertical: space[4] },
  legend: { flexDirection: "row", gap: space[24] },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  line: { width: 22, height: 0, borderTopWidth: 3, borderColor: colors.green },
  lineSolid: { borderStyle: "solid" },
  lineDashed: { borderStyle: "dashed", opacity: 0.7 },
  section: { gap: space[12] },
  leg: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space[12], gap: space[4], backgroundColor: colors.white },
  legSelected: { borderColor: colors.green, backgroundColor: colors.surface },
  legMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[8] },
  badge: { paddingHorizontal: space[8], paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.mint },
  badgeMuted: { backgroundColor: colors.surface },
});
