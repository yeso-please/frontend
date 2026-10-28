import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { toast } from "sonner-native";

import { attractionApi, courseApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { AlternativeItem } from "@/api/types";
import { AppText, BottomCTA, Button, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { CATEGORY_LABEL } from "@/features/course/components/CategoryGlyph";
import { useCourse, useCourseEdit } from "@/features/course/useCourse";
import { KakaoMapView, type MapBounds } from "@/features/kakaoMap";
import { haptics } from "@/lib/haptics";
import { withEulReul } from "@/lib/josa";
import { colors, motion, radius, screenPadding, space } from "@/theme";

import { attractionIdsInCourse, bboxOf, buildAddMarkers, type PickedPlace, pinKey } from "./addPlace";
import { AttractionDetailSheet } from "./components/AttractionDetailSheet";
import { CandidateRow } from "./components/CandidateRow";
import { SearchField } from "./components/SearchField";
import { useDebouncedValue, useScrollToRow } from "./hooks";
import { flattenAlternatives, pickTopAlternatives } from "./lib";

const MAP_HEIGHT = 300;
const TOP_N = 10;
const PIN_LIMIT = 200;
const candKey = (attractionId: number) => `cand-${attractionId}`;

/** 추가 실패 코드별 안내 (버전 충돌은 useCourseEdit가 다시 불러오고 알립니다) */
function addErrorMessage(e: unknown): string | null {
  if (isApiError(e, "TRIP_VERSION_CONFLICT")) return null;
  if (isApiError(e, "ATTRACTION_ALREADY_IN_COURSE")) return "이미 코스에 있는 장소예요";
  if (isApiError(e, "ATTRACTION_NOT_RECOMMENDABLE") || isApiError(e, "ATTRACTION_REGION_MISMATCH")) return "지금은 코스에 넣을 수 없는 장소예요";
  if (isApiError(e, "TRIP_ENDED")) return "끝난 여행의 코스는 바꿀 수 없어요";
  return errorMessage(e);
}

/**
 * 장소 추가 — 지도를 움직이며 이 지역 관광지 핀(7-3)을 보고, 추천 목록(5-4 추가용 후보)이나 핀에서 골라
 * 그 날 코스 맨 뒤에 넣습니다(5-3 ADD). 핀을 고르면 장소 정보(7-4)를 볼 수 있어요. 코스에 못 넣는 관광지는 흐리게 보입니다.
 */
export function AddPlaceScreen({ tripId, dayIndex }: { tripId: number; dayIndex: number }) {
  const course = useCourse(tripId);
  const edit = useCourseEdit(tripId);
  const sigCd = course.data?.regionSigCd ?? null;
  const day = course.data?.days.find((d) => d.dayIndex === dayIndex);
  const inCourse = useMemo(() => attractionIdsInCourse(course.data?.days ?? []), [course.data?.days]);

  // 지도를 움직이고 멈춘 범위의 관광지 핀만 불러옵니다
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const bbox = useDebouncedValue(bounds ? bboxOf(bounds) : null, 350);
  const pins = useQuery({
    queryKey: queryKeys.regionAttractions(sigCd ?? "", bbox),
    queryFn: () => attractionApi.pins(sigCd as string, { bbox: bbox ?? undefined, limit: PIN_LIMIT }),
    enabled: !!sigCd && !!bbox,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim(), 300).slice(0, 50);
  const searching = q.length > 0;
  // itemId 없이 부르면 추가용 후보입니다 (5-4)
  const alternatives = useQuery({
    queryKey: queryKeys.alternatives(tripId, null, q),
    queryFn: () => courseApi.alternatives(tripId, { limit: TOP_N, q: searching ? q : undefined }),
    enabled: !!course.data,
    placeholderData: keepPreviousData,
  });
  const candidates = useMemo(
    () => (searching ? flattenAlternatives(alternatives.data) : pickTopAlternatives(alternatives.data, null, TOP_N)).filter((c) => !inCourse.has(c.attractionId)),
    [searching, alternatives.data, inCourse],
  );

  const [picked, setPicked] = useState<PickedPlace | null>(null);
  const [mapTouching, setMapTouching] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const rows = useScrollToRow(scrollRef);
  const detailRef = useRef<BottomSheetModal>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const openDetail = (attractionId: number) => {
    setDetailId(attractionId);
    detailRef.current?.present();
  };

  const pinItems = useMemo(() => pins.data?.items ?? [], [pins.data]);
  const markers = useMemo(() => buildAddMarkers(day, pinItems, inCourse, picked?.attractionId ?? null), [day, pinItems, inCourse, picked]);
  // 처음 한 번만 그 날 코스가 보이게 맞추고, 그다음엔 사용자가 움직인 지도를 그대로 둡니다
  const fitKey = `day-${dayIndex}`;

  const pickCandidate = (item: AlternativeItem) =>
    setPicked((prev) => (prev?.attractionId === item.attractionId ? null : { attractionId: item.attractionId, name: item.name, category: item.category, recommendable: true, reason: item.reason }));

  const onMarkerPress = (id: string) => {
    if (!id.startsWith("pin-")) return;
    const pin = pinItems.find((p) => pinKey(p.attractionId) === id);
    if (!pin) return;
    haptics.tick();
    setPicked({ attractionId: pin.attractionId, name: pin.name, category: pin.category, recommendable: pin.recommendable, reason: null });
    rows.scrollToTop();
  };

  const add = () => {
    if (!picked || !picked.recommendable) return;
    edit.mutate([{ op: "ADD", dayIndex, attractionId: picked.attractionId }], {
      onSuccess: () => {
        haptics.confirm();
        toast.success(`${dayIndex + 1}일차에 ${withEulReul(picked.name)} 넣었어요`);
        router.back();
      },
      onError: (e) => {
        const msg = addErrorMessage(e);
        if (msg) toast.error(msg);
      },
    });
  };

  if (course.isPending) {
    return (
      <Screen>
        <TopBar title="장소 추가" />
        <LoadingView label="코스를 불러오는 중이에요" />
      </Screen>
    );
  }
  if (course.isError) {
    return (
      <Screen>
        <TopBar title="장소 추가" />
        <ErrorView error={course.error} onRetry={() => course.refetch()} />
      </Screen>
    );
  }
  if (!day || !sigCd) {
    return (
      <Screen>
        <TopBar title="장소 추가" />
        <EmptyView title="장소를 넣을 날을 찾을 수 없어요" description="코스가 바뀌었을 수 있어요." actionLabel="코스로 돌아가기" onAction={() => router.back()} />
      </Screen>
    );
  }

  const shownPins = pinItems.filter((p) => !inCourse.has(p.attractionId));
  const pinNote = !bbox
    ? "지도를 움직이면 그 범위의 관광지가 핀으로 보여요."
    : pins.isPending
      ? "관광지를 불러오는 중이에요…"
      : pins.data?.nextCursor
        ? `관광지 ${shownPins.length}곳 · 지도를 확대하면 더 보여요`
        : `이 범위의 관광지 ${shownPins.length}곳`;

  return (
    <Screen>
      <TopBar title="장소 추가" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} scrollEnabled={!mapTouching} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.springify().damping(motion.spring.gentle.damping)} style={styles.intro}>
            <AppText variant="title" accessibilityRole="header">
              {`${dayIndex + 1}일차에\n어디를 더 가 볼까요?`}
            </AppText>
            <AppText variant="body" color="muted">
              {"지도를 움직여 이 지역 관광지를 둘러보고,\n코스에 넣을 곳을 골라 보세요."}
            </AppText>
          </Animated.View>

          <View style={styles.block}>
            <KakaoMapView
              markers={markers}
              fitKey={fitKey}
              focusId={picked ? pinKey(picked.attractionId) : null}
              onMarkerPress={onMarkerPress}
              onBoundsChange={setBounds}
              onInteractionChange={setMapTouching}
              style={{ height: MAP_HEIGHT }}
              accessibilityLabel={`지도: ${dayIndex + 1}일차 코스와 이 지역 관광지 ${shownPins.length}곳`}
            />
            <View style={styles.legend}>
              <Legend dot={styles.dotCourse} label="이 날 코스" color="darkgreen" />
              <Legend dot={styles.dotPlace} label="넣을 수 있는 곳" color="blue" />
              <Legend dot={styles.dotOff} label="지금은 못 넣는 곳" color="muted" />
            </View>
            <AppText variant="small12" color="muted">
              {pinNote}
            </AppText>
          </View>

          {picked ? (
            <Animated.View entering={FadeInDown.springify().damping(motion.spring.gentle.damping)} exiting={FadeOut.duration(160)} layout={LinearTransition} style={[styles.summary, !picked.recommendable && styles.summaryOff]}>
              <AppText variant="small12" color={picked.recommendable ? "darkgreen" : "muted"}>
                {picked.recommendable ? `${dayIndex + 1}일차 맨 뒤에 넣을 예정이에요` : "지금은 코스에 넣을 수 없는 장소예요"}
              </AppText>
              <AppText variant="cardTitle" color={picked.recommendable ? "darkgreen" : "charcoal"}>
                {picked.name}
              </AppText>
              <AppText variant="small13" color="muted">
                {CATEGORY_LABEL[picked.category]}
              </AppText>
              {picked.reason ? (
                <AppText variant="small13" color="darkgreen">
                  {picked.reason}
                </AppText>
              ) : null}
              <PressableScale onPress={() => openDetail(picked.attractionId)} haptic="tick" hitSlop={8} style={styles.detailLink} accessibilityRole="button" accessibilityLabel={`${picked.name} 장소 정보 보기`}>
                <AppText variant="small13Medium" color="darkgreen">
                  장소 정보 보기 ›
                </AppText>
              </PressableScale>
            </Animated.View>
          ) : null}

          <View style={styles.block}>
            <AppText variant="cardTitle" accessibilityRole="header">
              {searching ? `'${q}' 검색 결과 ${candidates.length}` : `추천 장소 ${candidates.length}`}
            </AppText>
            <SearchField value={query} onChange={setQuery} placeholder="장소 이름으로 찾아보기" />
          </View>

          <View onLayout={(e) => rows.onListLayout(e.nativeEvent.layout.y)} style={styles.list}>
            {alternatives.isPending ? (
              <View style={styles.listState}>
                <LoadingView label="추천 장소를 고르는 중이에요" />
              </View>
            ) : alternatives.isError ? (
              <View style={styles.listState}>
                <ErrorView error={alternatives.error} onRetry={() => alternatives.refetch()} />
              </View>
            ) : candidates.length === 0 ? (
              <AppText variant="body" color="muted" align="center" style={styles.emptyText}>
                {searching ? `'${q}'에 맞는 장소가 이 지역에 없어요.` : "더 넣을 추천 장소가 없어요. 지도에서 골라 보세요."}
              </AppText>
            ) : (
              candidates.map((item, index) => (
                <CandidateRow
                  key={item.attractionId}
                  item={item}
                  index={index}
                  selected={picked?.attractionId === item.attractionId}
                  onPress={() => pickCandidate(item)}
                  onLayoutY={(y) => rows.onRowLayout(candKey(item.attractionId), y)}
                />
              ))
            )}
          </View>
        </ScrollView>

        <BottomCTA>
          <Button
            label={picked ? (picked.recommendable ? `${dayIndex + 1}일차 코스에 넣기` : "코스에 넣을 수 없는 장소예요") : "넣을 장소를 골라 주세요"}
            disabled={!picked || !picked.recommendable || edit.isPending}
            loading={edit.isPending}
            onPress={add}
            accessibilityHint={picked ? `${withEulReul(picked.name)} 그 날 코스 맨 뒤에 넣어요` : undefined}
          />
        </BottomCTA>
      </KeyboardAvoidingView>
      <AttractionDetailSheet sheetRef={detailRef} attractionId={detailId} />
    </Screen>
  );
}

function Legend({ dot, label, color }: { dot: object; label: string; color: "darkgreen" | "blue" | "muted" }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, dot]} />
      <AppText variant="small12" color={color}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[32], gap: space[24] },
  intro: { gap: space[8] },
  block: { gap: space[12] },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space[12] },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space[4] },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotCourse: { backgroundColor: colors.green },
  dotPlace: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.blue },
  dotOff: { backgroundColor: colors.border },
  summary: { gap: space[4], padding: space[16], borderRadius: radius.lg, backgroundColor: colors.mint },
  summaryOff: { backgroundColor: colors.surface },
  detailLink: { alignSelf: "flex-start", paddingVertical: space[4] },
  list: { gap: space[8] },
  listState: { minHeight: 160 },
  emptyText: { paddingVertical: space[24] },
});
