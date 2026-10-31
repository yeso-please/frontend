import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { toast } from "sonner-native";

import { courseApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { AlternativeItem } from "@/api/types";
import { AppText, BottomCTA, Button, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { ConfirmDialog } from "@/features/course/components/ConfirmDialog";
import { useCourse, useCourseEdit } from "@/features/course/useCourse";
import { KakaoMapView } from "@/features/kakaoMap";
import { kakaoMapLink } from "@/features/kakaoMap/links";
import { haptics } from "@/lib/haptics";
import { withEulReul, withEuro } from "@/lib/josa";
import { colors, motion, radius, screenPadding, space } from "@/theme";

import { AttractionBlurb } from "./components/AttractionBlurb";
import { AttractionDetailSheet } from "./components/AttractionDetailSheet";
import { CandidateRow } from "./components/CandidateRow";
import { CurrentPlaceCard } from "./components/CurrentPlaceCard";
import { NoteField } from "./components/NoteField";
import { SearchField } from "./components/SearchField";
import { useDebouncedValue, useScrollToRow } from "./hooks";
import { buildCandidateMarkers, findCourseItem, flattenAlternatives, isAttraction, pickTopAlternatives } from "./lib";

const MAP_HEIGHT = 240;
const TOP_N = 10;

const candKey = (attractionId: number) => `cand-${attractionId}`;

/** 편집 실패 코드별 안내 (버전 충돌은 useCourseEdit가 다시 불러오고 알립니다) */
function editErrorMessage(e: unknown): string | null {
  if (isApiError(e, "TRIP_VERSION_CONFLICT")) return null;
  if (isApiError(e, "ATTRACTION_ALREADY_IN_COURSE")) return "이미 코스에 있는 장소예요. 다른 후보를 골라 주세요";
  if (isApiError(e, "ATTRACTION_NOT_RECOMMENDABLE") || isApiError(e, "ATTRACTION_REGION_MISMATCH")) return "지금은 코스에 넣을 수 없는 장소예요";
  if (isApiError(e, "TRIP_ENDED")) return "끝난 여행의 코스는 바꿀 수 없어요";
  if (isApiError(e, "COURSE_ITEM_NOT_FOUND")) return "이 장소는 이미 코스에서 빠졌어요";
  return errorMessage(e);
}

/**
 * 피그마 초안 F1 · 장소 편집 — 지도에서 지금 장소와 대체 후보 위치를 함께 보고, 후보로 바꾸거나(5-3 REPLACE)
 * 코스에서 뺍니다(5-3 REMOVE). 후보는 5-4 대체 후보(요청자 취향·동선 순).
 */
export function PlaceEditScreen({ tripId, itemId }: { tripId: number; itemId: string }) {
  const course = useCourse(tripId);
  const edit = useCourseEdit(tripId);
  const found = findCourseItem(course.data, itemId);
  const current = found && isAttraction(found.item) ? found.item : null;

  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim(), 300).slice(0, 50);
  const searching = q.length > 0;
  const alternatives = useQuery({
    queryKey: queryKeys.alternatives(tripId, itemId, q),
    queryFn: () => courseApi.alternatives(tripId, { itemId, limit: TOP_N, q: searching ? q : undefined }),
    enabled: !!current,
    placeholderData: keepPreviousData,
  });

  const candidates = useMemo(
    () => (searching ? flattenAlternatives(alternatives.data) : pickTopAlternatives(alternatives.data, current?.category ?? null, TOP_N)),
    [searching, alternatives.data, current?.category],
  );
  const [selected, setSelected] = useState<AlternativeItem | null>(null);
  // 관광지 상세 (7-4): 지금 장소나 고른 후보의 설명·운영 시간·사진
  const detailRef = useRef<BottomSheetModal>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const openDetail = (attractionId: number) => {
    setDetailId(attractionId);
    detailRef.current?.present();
  };
  const [note, setNote] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [mapTouching, setMapTouching] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const rows = useScrollToRow(scrollRef);

  const markers = useMemo(() => (current ? buildCandidateMarkers(current, candidates, selected?.attractionId ?? null) : []), [current, candidates, selected]);
  const fitKey = useMemo(() => candidates.map((c) => c.attractionId).join(","), [candidates]);

  const select = (item: AlternativeItem) => setSelected((prev) => (prev?.attractionId === item.attractionId ? null : item));

  const onMarkerPress = (id: string) => {
    haptics.tick();
    if (id.startsWith("current-")) {
      rows.scrollToTop();
      return;
    }
    const target = candidates.find((c) => candKey(c.attractionId) === id);
    if (!target) return;
    setSelected(target);
    rows.scrollTo(id);
  };

  const trimmedNote = note.trim() || undefined;

  const replace = () => {
    if (!current || !selected) return;
    edit.mutate([{ op: "REPLACE", itemId, attractionId: selected.attractionId, note: trimmedNote }], {
      onSuccess: () => {
        haptics.confirm();
        toast.success(`${withEulReul(current.name)} ${withEuro(selected.name)} 바꿨어요`);
        router.back();
      },
      onError: (e) => {
        const msg = editErrorMessage(e);
        if (msg) toast.error(msg);
        if (isApiError(e, "ATTRACTION_ALREADY_IN_COURSE")) void alternatives.refetch();
      },
    });
  };

  const remove = () => {
    if (!current) return;
    edit.mutate([{ op: "REMOVE", itemId, note: trimmedNote }], {
      onSuccess: () => {
        setConfirmRemove(false);
        haptics.confirm();
        toast.success(`${withEulReul(current.name)} 코스에서 뺐어요`, { description: "변경 표시에서 다시 넣을 수 있어요" });
        router.back();
      },
      onError: (e) => {
        setConfirmRemove(false);
        const msg = editErrorMessage(e);
        if (msg) toast.error(msg);
      },
    });
  };

  if (course.isPending) {
    return (
      <Screen>
        <TopBar title="장소 편집" />
        <LoadingView label="코스를 불러오는 중이에요" />
      </Screen>
    );
  }
  if (course.isError) {
    return (
      <Screen>
        <TopBar title="장소 편집" />
        <ErrorView error={course.error} onRetry={() => course.refetch()} />
      </Screen>
    );
  }
  if (!current || !found) {
    return (
      <Screen>
        <TopBar title="장소 편집" />
        <EmptyView title="이 장소를 찾을 수 없어요" description="다른 참여자가 먼저 바꿨거나 코스에서 뺐을 수 있어요." actionLabel="코스로 돌아가기" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="장소 편집" />
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
            <AppText variant="title" accessibilityRole="header">
              {"어떤 장소로\n바꿔볼까요?"}
            </AppText>
            <AppText variant="body" color="muted">
              {"지도에서 위치를 살펴보고,\n여행 분위기에 맞는 곳을 골라보세요."}
            </AppText>
          </Animated.View>

          <View style={styles.block}>
            <AppText variant="small13" color="muted">
              현재 장소
            </AppText>
            <CurrentPlaceCard item={current} dayIndex={found.dayIndex} />
            <AttractionBlurb attractionId={current.attractionId} onMore={() => openDetail(current.attractionId)} />
            <PressableScale onPress={() => openDetail(current.attractionId)} haptic="tick" hitSlop={8} style={styles.detailLink} accessibilityRole="button" accessibilityLabel={`${current.name} 장소 정보 보기`}>
              <AppText variant="small13Medium" color="darkgreen">
                장소 정보 보기 ›
              </AppText>
            </PressableScale>
          </View>

          <View style={styles.block}>
            <KakaoMapView
              markers={markers}
              fitKey={fitKey}
              focusId={selected ? candKey(selected.attractionId) : null}
              onMarkerPress={onMarkerPress}
              onInteractionChange={setMapTouching}
              style={{ height: MAP_HEIGHT }}
              accessibilityLabel={`지도: ${current.name}과 대체 후보 ${candidates.length}곳`}
            />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, styles.dotCurrent]} />
                <AppText variant="small12" color="darkgreen">
                  현재 장소
                </AppText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, styles.dotCandidate]} />
                <AppText variant="small12" color="blue">
                  대체 후보
                </AppText>
              </View>
            </View>
            <AppText variant="small12" color="muted">
              위치 관계 미리보기 · 지도 핀과 목록을 함께 확인해요.
            </AppText>
            <Button
              label="카카오맵에서 주변 보기"
              variant="secondary"
              height={48}
              onPress={() => Linking.openURL(kakaoMapLink(current.name, current.lat, current.lng)).catch(() => toast.error("카카오맵을 열 수 없어요"))}
              accessibilityHint="카카오맵 앱이나 웹으로 이동해요"
            />
          </View>

          <View style={styles.block}>
            <AppText variant="cardTitle" accessibilityRole="header">
              {searching ? `'${q}' 검색 결과 ${candidates.length}` : `대체 추천 장소 ${candidates.length}`}
            </AppText>
            <SearchField value={query} onChange={setQuery} placeholder="장소 이름으로 찾아보기" />
          </View>

          <View onLayout={(e) => rows.onListLayout(e.nativeEvent.layout.y)} style={styles.list}>
            {alternatives.isPending ? (
              <View style={styles.listState}>
                <LoadingView label="후보를 고르는 중이에요" />
              </View>
            ) : alternatives.isError ? (
              <View style={styles.listState}>
                <ErrorView error={alternatives.error} onRetry={() => alternatives.refetch()} />
              </View>
            ) : candidates.length === 0 ? (
              <AppText variant="body" color="muted" align="center" style={styles.emptyText}>
                {searching ? `'${q}'에 맞는 장소가 이 지역에 없어요.` : "지금은 바꿀 수 있는 후보가 없어요."}
              </AppText>
            ) : (
              candidates.map((item, index) => (
                <CandidateRow
                  key={item.attractionId}
                  item={item}
                  index={index}
                  selected={selected?.attractionId === item.attractionId}
                  onPress={() => select(item)}
                  onLayoutY={(y) => rows.onRowLayout(candKey(item.attractionId), y)}
                />
              ))
            )}
          </View>

          {selected ? (
            <Animated.View
              entering={FadeInDown.springify().damping(motion.spring.gentle.damping)}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition}
              style={styles.summary}
              accessible
              accessibilityLabel={`${selected.name}으로 바꿀 예정이에요. 지금 장소는 ${current.name}`}
            >
              <AppText variant="small12" color="darkgreen">
                이 장소로 바꿀 예정이에요
              </AppText>
              <AppText variant="cardTitle" color="darkgreen">
                {selected.name}
              </AppText>
              {selected.reason ? (
                <AppText variant="small13" color="darkgreen">
                  {selected.reason}
                </AppText>
              ) : null}
              {/* 추천 이유 → 한 줄 소개 → 설명 앞부분 (요청서 #3) */}
              <AttractionBlurb attractionId={selected.attractionId} onMore={() => openDetail(selected.attractionId)} />
              <AppText variant="small12" color="muted">{`지금 장소 · ${current.name}`}</AppText>
              <PressableScale onPress={() => openDetail(selected.attractionId)} haptic="tick" hitSlop={8} style={styles.detailLink} accessibilityRole="button" accessibilityLabel={`${selected.name} 장소 정보 보기`}>
                <AppText variant="small13Medium" color="darkgreen">
                  장소 정보 보기 ›
                </AppText>
              </PressableScale>
              <AppText variant="small12" color="darkgreen">
                기존 장소의 추가·추천 이력은 변경 표시에서 유지해요.
              </AppText>
            </Animated.View>
          ) : null}

          <Animated.View layout={LinearTransition} style={styles.block}>
            <NoteField value={note} onChange={setNote} label="친구에게 남길 이유 (선택)" placeholder="예: 바다를 더 오래 보고 싶어요" />
          </Animated.View>
        </ScrollView>

        <BottomCTA>
          <Button
            label={selected ? "이 장소로 변경하기" : "바꿀 장소를 골라 주세요"}
            rightIcon={selected ? <AppText variant="label">→</AppText> : undefined}
            disabled={!selected || edit.isPending}
            loading={edit.isPending && !confirmRemove}
            onPress={replace}
          />
          <View style={styles.subActions}>
            <Button label="기존 장소 유지하기" variant="secondary" height={44} style={styles.subAction} onPress={() => router.back()} disabled={edit.isPending} />
            <Button
              label="장소 삭제하기"
              variant="neutral"
              labelColor="danger"
              height={44}
              style={styles.subAction}
              onPress={() => setConfirmRemove(true)}
              disabled={edit.isPending}
            />
          </View>
        </BottomCTA>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmRemove}
        title={`${withEulReul(current.name)} 코스에서 뺄까요?`}
        body={`친구들에게 '제외'로 보이고, 변경 표시에서 다시 넣을 수 있어요.${trimmedNote ? `\n남길 이유: ${trimmedNote}` : ""}`}
        confirmLabel="코스에서 빼기"
        cancelLabel="그대로 둘게요"
        destructive
        loading={edit.isPending}
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
      <AttractionDetailSheet sheetRef={detailRef} attractionId={detailId} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  detailLink: { alignSelf: "flex-start", paddingVertical: space[4] },
  flex: { flex: 1 },
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[24], gap: space[24] },
  intro: { gap: space[8] },
  block: { gap: space[12] },
  legend: { flexDirection: "row", gap: space[24] },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotCurrent: { backgroundColor: colors.darkgreen },
  dotCandidate: { borderWidth: 1.5, borderColor: colors.blue, backgroundColor: colors.white },
  list: { gap: space[12] },
  listState: { height: 200 },
  emptyText: { paddingVertical: space[24] },
  summary: { backgroundColor: colors.mint, borderRadius: radius.lg, padding: space[16], gap: space[4] },
  subActions: { flexDirection: "row", gap: space[8], marginTop: space[8] },
  subAction: { flex: 1 },
});
