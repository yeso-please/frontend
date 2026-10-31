import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { toast } from "sonner-native";

import { courseApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { MealItem, RestaurantCandidate, RestaurantOrigin } from "@/api/types";
import { AppText, BottomCTA, Button, EmptyView, ErrorView, LoadingView, Screen, TopBar } from "@/components/ui";
import { ConfirmDialog } from "@/features/course/components/ConfirmDialog";
import { mealLabel } from "@/features/course/format";
import { useCourse, useCourseEdit } from "@/features/course/useCourse";
import { KakaoMapView, type MapMarker } from "@/features/kakaoMap";
import { kakaoMapLink } from "@/features/kakaoMap/links";
import { haptics } from "@/lib/haptics";
import { withEulReul, withEunNeun, withEuro } from "@/lib/josa";
import { colors, motion, radius, screenPadding, space } from "@/theme";

import { RestaurantRow } from "./components/RestaurantRow";
import { SearchField } from "./components/SearchField";
import { useScrollToRow } from "./hooks";
import { findCourseItem, isMeal, nonEmptySections, restaurantCategoryLabel } from "./lib";

const MAP_HEIGHT = 220;
/** 지도에 올리는 후보 수 (번호가 겹치지 않게) */
const MAP_LIMIT = 15;
const MAX_PAGE = 45;

const keyOf = (r: Pick<RestaurantCandidate, "provider" | "externalId">) => `${r.provider}:${r.externalId}`;

function searchErrorMessage(e: unknown) {
  if (isApiError(e, "COURSE_KAKAO_LOCAL_RATE_LIMITED")) return "검색이 몰려 잠시 쉬고 있어요. 조금 뒤 다시 찾아 주세요.";
  if (isApiError(e, "COURSE_KAKAO_LOCAL_UNAVAILABLE")) return "카카오 검색에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
  return errorMessage(e);
}

function originText(origin: RestaurantOrigin | undefined) {
  if (!origin) return "같은 지역 안의 식당만 보여 드려요.";
  return origin.type === "PREVIOUS_ATTRACTION" ? "바로 앞 장소 근처, 같은 지역 식당이에요." : "그날 앞 장소가 없어 지역 중심 근처 식당이에요.";
}

/**
 * 식사 카드(D6)의 식당 고르기 — 5-5 추천(관광공사 음식점 등 원천별 섹션)과 5-6 카카오 검색.
 * 고른 식당은 5-3 SET_RESTAURANT(selectionToken 그대로), 비우면 CLEAR_RESTAURANT로 "미정"이 됩니다.
 */
export function MealScreen({ tripId, itemId }: { tripId: number; itemId: string }) {
  const queryClient = useQueryClient();
  const course = useCourse(tripId);
  const edit = useCourseEdit(tripId);
  const found = findCourseItem(course.data, itemId);
  const meal: MealItem | null = found && isMeal(found.item) ? found.item : null;

  const recs = useQuery({
    queryKey: queryKeys.restaurants(tripId, itemId),
    queryFn: () => courseApi.restaurantRecommendations(tripId, itemId),
    enabled: !!meal,
  });
  const sections = nonEmptySections(recs.data);
  const recsEmpty = recs.isSuccess && sections.length === 0;

  const [input, setInput] = useState("");
  /** null이면 추천 목록, 문자열이면 카카오 검색(빈 문자열 = 주변 음식점 전체) */
  const [submitted, setSubmitted] = useState<string | null>(null);
  // 추천이 모두 비면 같은 기준점으로 카카오 주변 검색을 자동으로 보여 줍니다 (5-5 안내).
  const searchQuery = submitted ?? (recsEmpty ? "" : null);
  const search = useInfiniteQuery({
    queryKey: [...queryKeys.restaurants(tripId, itemId), "search", searchQuery ?? ""],
    queryFn: ({ pageParam }) => courseApi.restaurantSearch(tripId, { itemId, query: searchQuery || undefined, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.isEnd || last.page >= MAX_PAGE ? undefined : last.page + 1),
    enabled: !!meal && searchQuery !== null,
    placeholderData: keepPreviousData,
    retry: (count, e) => !isApiError(e, "COURSE_KAKAO_LOCAL_RATE_LIMITED") && count < 1,
  });
  const searching = searchQuery !== null;
  const searchItems = useMemo(() => {
    const seen = new Set<string>();
    return (search.data?.pages ?? []).flatMap((p) => p.items).filter((r) => (seen.has(keyOf(r)) ? false : (seen.add(keyOf(r)), true)));
  }, [search.data]);

  const visible = useMemo(() => (searching ? searchItems : sections.flatMap((s) => s.items)), [searching, searchItems, sections]);
  const numberOf = useMemo(() => new Map(visible.map((r, i) => [keyOf(r), i + 1])), [visible]);
  const origin = recs.data?.origin ?? search.data?.pages[0]?.origin;

  const [selected, setSelected] = useState<RestaurantCandidate | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [mapTouching, setMapTouching] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const rows = useScrollToRow(scrollRef);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = visible.slice(0, MAP_LIMIT).map((r, i) => ({
      id: keyOf(r),
      lat: r.lat,
      lng: r.lng,
      kind: "meal",
      number: i + 1,
      selected: !!selected && keyOf(selected) === keyOf(r),
    }));
    return origin ? [{ id: "origin", lat: origin.lat, lng: origin.lng, kind: "origin" }, ...list] : list;
  }, [visible, selected, origin]);
  const fitKey = useMemo(() => visible.slice(0, MAP_LIMIT).map(keyOf).join(","), [visible]);

  const runSearch = () => {
    const q = input.trim();
    setSelected(null);
    setSubmitted(q);
  };
  const backToRecommendations = () => {
    setInput("");
    setSelected(null);
    setSubmitted(null);
  };

  const refreshCandidates = () => {
    setSelected(null);
    void queryClient.invalidateQueries({ queryKey: queryKeys.restaurants(tripId, itemId) });
  };

  const choose = () => {
    if (!selected || !meal) return;
    edit.mutate([{ op: "SET_RESTAURANT", itemId, selectionToken: selected.selectionToken }], {
      onSuccess: () => {
        haptics.confirm();
        toast.success(`${mealLabel(meal.meal)}은 ${withEuro(selected.name)} 정했어요`);
        router.back();
      },
      onError: (e) => {
        if (isApiError(e, "COURSE_RESTAURANT_SELECTION_INVALID")) {
          // 추천 결과의 선택 토큰은 30분 동안만 쓸 수 있습니다
          toast("식당 정보가 오래돼 새로 불러왔어요. 다시 골라 주세요");
          refreshCandidates();
        } else if (!isApiError(e, "TRIP_VERSION_CONFLICT")) {
          toast.error(isApiError(e, "TRIP_ENDED") ? "끝난 여행의 코스는 바꿀 수 없어요" : errorMessage(e));
        }
      },
    });
  };

  const clear = () => {
    if (!meal) return;
    edit.mutate([{ op: "CLEAR_RESTAURANT", itemId }], {
      onSuccess: () => {
        setConfirmClear(false);
        haptics.confirm();
        toast.success("식당을 비웠어요", { description: "코스에서는 '미정'으로 보여요" });
        router.back();
      },
      onError: (e) => {
        setConfirmClear(false);
        if (!isApiError(e, "TRIP_VERSION_CONFLICT")) toast.error(errorMessage(e));
      },
    });
  };

  /** 이 날 이 끼니를 코스에서 뺍니다 (5-3 REMOVE 식사). 코스 화면 그날 목록 아래 "다시 넣기"로 돌아옵니다. */
  const dropMeal = () => {
    if (!meal) return;
    const name = mealLabel(meal.meal);
    edit.mutate([{ op: "REMOVE", itemId }], {
      onSuccess: () => {
        setConfirmDrop(false);
        haptics.confirm();
        toast.success(`${name}을 코스에서 뺐어요`, { description: "코스 화면 그날 목록 아래에서 다시 넣을 수 있어요" });
        router.back();
      },
      onError: (e) => {
        setConfirmDrop(false);
        if (!isApiError(e, "TRIP_VERSION_CONFLICT")) toast.error(isApiError(e, "TRIP_ENDED") ? "끝난 여행의 코스는 바꿀 수 없어요" : errorMessage(e));
      },
    });
  };

  const onMarkerPress = (id: string) => {
    if (id === "origin") return;
    const target = visible.find((r) => keyOf(r) === id);
    if (!target) return;
    haptics.tick();
    setSelected(target);
    rows.scrollTo(id);
  };

  if (course.isPending) {
    return (
      <Screen>
        <TopBar title="식당 고르기" />
        <LoadingView label="코스를 불러오는 중이에요" />
      </Screen>
    );
  }
  if (course.isError) {
    return (
      <Screen>
        <TopBar title="식당 고르기" />
        <ErrorView error={course.error} onRetry={() => course.refetch()} />
      </Screen>
    );
  }
  if (!meal || !found) {
    return (
      <Screen>
        <TopBar title="식당 고르기" />
        <EmptyView title="이 식사를 찾을 수 없어요" description="코스가 다시 만들어졌을 수 있어요." actionLabel="코스로 돌아가기" onAction={() => router.back()} />
      </Screen>
    );
  }

  const label = mealLabel(meal.meal);
  const current = meal.restaurant;

  const renderRows = (items: RestaurantCandidate[]) =>
    items.map((r) => (
      <RestaurantRow
        key={keyOf(r)}
        item={r}
        number={numberOf.get(keyOf(r)) ?? 0}
        selected={!!selected && keyOf(selected) === keyOf(r)}
        onPress={() => setSelected((prev) => (prev && keyOf(prev) === keyOf(r) ? null : r))}
        onLayoutY={(y) => rows.onRowLayout(keyOf(r), y)}
      />
    ));

  return (
    <Screen>
      <TopBar title="식당 고르기" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          scrollEnabled={!mapTouching}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.springify().damping(motion.spring.gentle.damping)} style={styles.intro}>
            <AppText variant="small13Bold" color="darkgreen">{`${found.dayIndex + 1}일차 ${label}`}</AppText>
            <AppText variant="title" accessibilityRole="header">{`${withEunNeun(label)}\n어디서 먹을까요?`}</AppText>
            <AppText variant="body" color="muted">
              {originText(origin)}
            </AppText>
          </Animated.View>

          <View style={styles.currentCard} accessible accessibilityLabel={current ? `지금 정한 식당 ${current.name}` : `${label} 식당 미정`}>
            <View style={styles.chip}>
              <AppText variant="caption" color="darkgreen">
                {`지금 정한 ${label}`}
              </AppText>
            </View>
            {current ? (
              <>
                <AppText variant="taskTitle">{current.name}</AppText>
                <AppText variant="small12" color="muted">
                  {[restaurantCategoryLabel(current.category), current.roadAddress ?? current.address].filter(Boolean).join(" · ")}
                </AppText>
                <View style={styles.currentActions}>
                  <Button
                    label="카카오맵에서 보기"
                    variant="outline"
                    height={40}
                    style={styles.flex}
                    onPress={() => Linking.openURL(current.placeUrl ?? kakaoMapLink(current.name, current.lat, current.lng)).catch(() => undefined)}
                  />
                  <Button label="식당 비우기" variant="neutral" labelColor="danger" height={40} style={styles.flex} onPress={() => setConfirmClear(true)} disabled={edit.isPending} />
                </View>
              </>
            ) : (
              <AppText variant="body" color="muted">
                아직 정하지 않았어요 · 코스에는 &apos;미정&apos;으로 보여요
              </AppText>
            )}
          </View>

          <KakaoMapView
            markers={markers}
            fitKey={fitKey}
            focusId={selected ? keyOf(selected) : null}
            onMarkerPress={onMarkerPress}
            onInteractionChange={setMapTouching}
            style={{ height: MAP_HEIGHT }}
            accessibilityLabel={`지도: ${label} 식당 후보 ${Math.min(visible.length, MAP_LIMIT)}곳`}
          />

          <View style={styles.block}>
            <SearchField value={input} onChange={setInput} onSubmit={runSearch} placeholder="카카오맵에서 식당 찾기 (예: 칼국수)" />
            <View style={styles.searchActions}>
              <Button label="찾기" variant="secondary" height={40} style={styles.flex} onPress={runSearch} />
              {submitted !== null ? <Button label="추천 다시 보기" variant="outline" height={40} style={styles.flex} onPress={backToRecommendations} /> : null}
            </View>
          </View>

          <View onLayout={(e) => rows.onListLayout(e.nativeEvent.layout.y)} style={styles.list}>
            {!searching ? (
              recs.isPending ? (
                <View style={styles.listState}>
                  <LoadingView label="근처 식당을 찾는 중이에요" />
                </View>
              ) : recs.isError ? (
                <View style={styles.listState}>
                  <ErrorView error={recs.error} onRetry={() => recs.refetch()} />
                </View>
              ) : (
                sections.map((section) => (
                  <View key={section.source} style={styles.section}>
                    <AppText variant="label" accessibilityRole="header">
                      {section.label}
                    </AppText>
                    {renderRows(section.items)}
                  </View>
                ))
              )
            ) : (
              <View style={styles.section}>
                <AppText variant="label" accessibilityRole="header">
                  {submitted ? `카카오맵 검색 · '${submitted}'` : "카카오맵 주변 음식점"}
                </AppText>
                {recsEmpty && submitted === null ? (
                  <AppText variant="small12" color="muted">
                    추천할 등록 음식점이 없어 카카오맵 검색 결과를 보여 드려요.
                  </AppText>
                ) : null}
                {search.isPending ? (
                  <View style={styles.listState}>
                    <LoadingView label="카카오맵에서 찾는 중이에요" />
                  </View>
                ) : search.isError ? (
                  <View style={styles.inlineError}>
                    <AppText variant="body" color="muted" align="center">
                      {searchErrorMessage(search.error)}
                    </AppText>
                    <Button label="다시 찾기" variant="neutral" height={40} onPress={() => search.refetch()} />
                  </View>
                ) : searchItems.length === 0 ? (
                  <AppText variant="body" color="muted" align="center" style={styles.emptyText}>
                    {submitted ? `'${submitted}'에 맞는 식당을 근처에서 찾지 못했어요.` : "근처에서 식당을 찾지 못했어요."}
                  </AppText>
                ) : (
                  <>
                    {renderRows(searchItems)}
                    {search.hasNextPage ? (
                      <Button label="더 보기" variant="outline" height={44} loading={search.isFetchingNextPage} onPress={() => search.fetchNextPage()} />
                    ) : null}
                  </>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        <BottomCTA helper={`이 날 ${label} 빼기`} onHelperPress={() => setConfirmDrop(true)}>
          <Button
            label={selected ? `${withEuro(selected.name)} 정하기` : "식당을 골라 주세요"}
            disabled={!selected || edit.isPending}
            loading={edit.isPending && !confirmClear && !confirmDrop}
            onPress={choose}
          />
        </BottomCTA>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmClear}
        title={`${label} 식당을 비울까요?`}
        body="코스에서는 '미정'으로 보이고, 언제든 다시 고를 수 있어요."
        confirmLabel="식당 비우기"
        cancelLabel="그대로 둘게요"
        destructive
        loading={edit.isPending}
        onConfirm={clear}
        onCancel={() => setConfirmClear(false)}
      />
      <ConfirmDialog
        visible={confirmDrop}
        title={`코스에서 ${withEulReul(label)} 뺄까요?`}
        body="고른 식당도 함께 빠져요. 나중에 코스 화면에서 다시 넣을 수 있어요."
        confirmLabel={`${label} 빼기`}
        cancelLabel="그대로 둘게요"
        destructive
        loading={edit.isPending}
        onConfirm={dropMeal}
        onCancel={() => setConfirmDrop(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[24], gap: space[24] },
  intro: { gap: space[8] },
  block: { gap: space[8] },
  currentCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space[16], gap: space[8], backgroundColor: colors.white },
  chip: { alignSelf: "flex-start", height: 24, paddingHorizontal: 10, borderRadius: radius.sm, justifyContent: "center", backgroundColor: colors.mint },
  currentActions: { flexDirection: "row", gap: space[8], marginTop: space[4] },
  searchActions: { flexDirection: "row", gap: space[8] },
  list: { gap: space[24] },
  section: { gap: space[12] },
  listState: { height: 180 },
  inlineError: { gap: space[12], paddingVertical: space[16] },
  emptyText: { paddingVertical: space[24] },
});
