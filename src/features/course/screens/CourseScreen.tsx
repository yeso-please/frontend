import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeInDown, useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { toast } from "sonner-native";

import { regionApi, tripApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { Icons } from "@/components/icons";
import { AppText, BottomCTA, Button, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { AttractionDetailSheet } from "@/features/place/components/AttractionDetailSheet";
import { CourseShareSheet } from "@/features/share/CourseShareSheet";
import { diffDays } from "@/lib/date";
import { haptics } from "@/lib/haptics";
import { shortRegionName, withEuro } from "@/lib/josa";
import { useAuthStore } from "@/store/auth";
import { colors, motion, screenPadding, space } from "@/theme";

import { ConfirmDialog } from "../components/ConfirmDialog";
import { CourseBody, type CourseTab } from "../components/CourseBody";
import { CourseHeader } from "../components/CourseHeader";
import { GenerateCourseView } from "../components/GenerateCourseView";
import { presenceSentence, tripTitle } from "../format";
import { applyMove } from "../reorder";
import { useCourse, useCourseEdit, useGenerateCourse } from "../useCourse";
import { usePresence } from "../usePresence";

const POLL_MS = 20_000;
const STATUS_MS = 4_000;

/**
 * 피그마 E0 첫 코스 · E1 함께 만드는 코스 · E2 변경 표시 · E5~E8 순서 바꾸기
 * fromPrep: 여행 준비 3/4(친구 초대)에서 넘어온 4/4 단계. 이때는 "여행 준비 완료"로 준비를 끝맺습니다.
 */
export function CourseScreen({ tripId, fromPrep = false }: { tripId: number; fromPrep?: boolean }) {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  // 이 화면에서 첫 코스를 만들어도 준비 중인 것으로 봅니다 (홈 카드 "이어서 준비하기"로 들어온 경우).
  const [preparing, setPreparing] = useState(fromPrep);
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const dragging = useRef(false);
  const course = useCourse(tripId, { poll: focused ? () => (dragging.current ? false : POLL_MS) : false });
  const context = useQuery({ queryKey: queryKeys.tripContext(tripId), queryFn: () => tripApi.context(tripId) });
  const participants = useQuery({ queryKey: queryKeys.participants(tripId), queryFn: () => tripApi.participants(tripId), refetchInterval: focused ? POLL_MS : false });
  const noCourse = isApiError(course.error, "COURSE_NOT_FOUND");
  const regionSigCd = context.data?.regionSigCd ?? null;
  // 코스가 없으면 지역 이름을 지역 카드에서 받습니다 (B4에서 이미 받아 둔 캐시가 있으면 그대로 씁니다)
  const regionCard = useQuery({ queryKey: queryKeys.regionCard(regionSigCd ?? ""), queryFn: () => regionApi.card(regionSigCd!), enabled: noCourse && !!regionSigCd });

  const generate = useGenerateCourse(tripId);
  const edit = useCourseEdit(tripId);
  const watchers = usePresence(tripId, !!context.data);

  const [tab, setTab] = useState<CourseTab>("all");
  const [scrollTopTick, setScrollTopTick] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  useEffect(() => {
    if (scrollTopTick > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollTopTick, scrollRef]);
  // 스크롤 위치는 onScroll로 받습니다. useScrollViewOffset은 처음 렌더(로딩 화면)에 ScrollView가 없으면 붙지 못해
  // 드래그 중 자동 스크롤이 맨 위로 튀었습니다.
  const offset = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    offset.set(e.contentOffset.y);
  });
  const contentHeight = useSharedValue(0);

  const flash = (text: string | null, sticky = false) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus(text);
    if (text && !sticky) statusTimer.current = setTimeout(() => setStatus(null), STATUS_MS);
  };

  // 지역이 없는 옛 여행: 여기서 바로 랜덤으로 정합니다 (3-7)
  const pickRegion = useMutation({
    mutationFn: async () => {
      const ctx = await tripApi.context(tripId);
      return tripApi.decideRegion(tripId, { mode: "RANDOM", version: ctx.version });
    },
    onSuccess: (res) => {
      haptics.confirm();
      toast(`${withEuro(shortRegionName(res.province, res.city))} 정했어요`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tripContext(tripId) });
    },
    onError: (e) => toast(errorMessage(e)),
  });

  const runGenerate = (regenerate = false) =>
    generate.mutate(undefined, {
      onSuccess: () => {
        setConfirmRegenerate(false);
        setTab("all");
        setDayIndex(0);
        if (regenerate) toast("새 코스를 만들었어요");
        else setPreparing(true);
      },
      onError: (e) => {
        setConfirmRegenerate(false);
        if (isApiError(e, "COURSE_CREATOR_ONLY")) {
          toast("첫 코스는 여행을 만든 사람이 만들어요");
          void participants.refetch();
        } else if (isApiError(e, "TRIP_REGION_NOT_SELECTED")) {
          void context.refetch();
        } else if (isApiError(e, "COURSE_INSUFFICIENT_CANDIDATES")) {
          toast("이 지역은 이 기간에 넣을 장소가 모자라요");
        } else if (!isApiError(e, "TRIP_VERSION_CONFLICT")) {
          toast(errorMessage(e));
        }
      },
    });

  const onMove = (itemId: string, toDay: number, position: number) => {
    dragging.current = false;
    flash("✓ 순서를 바꿨어요 · 이동 시간을 다시 확인하고 있어요", true);
    edit.mutate(
      { operations: [{ op: "MOVE", itemId, dayIndex: toDay, position }], optimistic: (c) => applyMove(c, itemId, { dayIndex: toDay, position }) },
      {
        onSuccess: () => {
          haptics.confirm();
          flash("✓ 순서를 바꿨어요 · 친구의 추가·제외·교체는 그대로 남아요");
        },
        onError: (e) => {
          flash(null);
          if (!isApiError(e, "TRIP_VERSION_CONFLICT")) toast(errorMessage(e));
        },
      },
    );
  };

  const onRestore = (removalId: number) => {
    setRestoringId(removalId);
    edit.mutate([{ op: "RESTORE", removalId }], {
      onSuccess: () => {
        haptics.confirm();
        flash("✓ 제외했던 장소를 다시 넣었어요");
      },
      onError: (e) => {
        if (!isApiError(e, "TRIP_VERSION_CONFLICT")) toast(errorMessage(e));
      },
      onSettled: () => setRestoringId(null),
    });
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  const openParticipants = () => router.push({ pathname: "/trip/[tripId]/participants", params: { tripId: String(tripId) } });
  const shareRef = useRef<BottomSheetModal>(null);
  // 관광지 상세 (7-4): 코스 카드의 "상세보기"·사진 줄에서 엽니다.
  const detailRef = useRef<BottomSheetModal>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const openDetail = (attractionId: number) => {
    setDetailId(attractionId);
    detailRef.current?.present();
  };

  // ── 상태별 화면 ──
  /** 하단 버튼으로 탭을 바꾸면 변경 요약이 보이도록 맨 위로 올립니다 (E1 → E2) */
  const switchTab = (next: CourseTab) => {
    setTab(next);
    setScrollTopTick((n) => n + 1);
  };

  if (course.isPending && context.isPending) {
    return (
      <Screen>
        <TopBar title="함께 만드는 코스" onBack={goBack} />
        <LoadingView label="코스를 불러오는 중이에요" />
      </Screen>
    );
  }
  if (isApiError(context.error, "TRIP_NOT_FOUND") || isApiError(course.error, "TRIP_NOT_FOUND")) {
    return (
      <Screen>
        <TopBar title="함께 만드는 코스" onBack={goBack} />
        <EmptyView title="여행을 찾을 수 없어요" description="여행에서 나갔거나 내보내졌을 수 있어요." actionLabel="홈으로" onAction={() => router.replace("/(tabs)")} />
      </Screen>
    );
  }
  if ((course.isError && !noCourse) || (context.isError && !course.data)) {
    return (
      <Screen>
        <TopBar title="함께 만드는 코스" onBack={goBack} />
        <ErrorView
          error={course.error ?? context.error}
          onRetry={() => {
            void course.refetch();
            void context.refetch();
          }}
        />
      </Screen>
    );
  }

  const data = course.data;
  const travelers = (participants.data ?? []).map((p) => p.nickname);
  const creator = participants.data?.find((p) => p.isCreator) ?? null;
  const canGenerate = !creator || creator.userId === me?.id;
  const startDate = data?.startDate ?? context.data?.startDate ?? "";
  const endDate = data?.endDate ?? context.data?.endDate ?? startDate;
  const regionName = data?.regionName ?? (regionCard.data ? `${regionCard.data.province} ${regionCard.data.city}` : null);
  const title = tripTitle(regionName, "새 여행");
  const regionShort = regionCard.data ? shortRegionName(regionCard.data.province, regionCard.data.city) : title.replace(/ 여행$/, "");
  const watching = presenceSentence(watchers);
  const headerLine = watching ? { text: watching, live: true } : { text: "친구와 함께 장소를 추가·제외할 수 있어요." };
  const transport = context.data?.transport ?? "CAR";

  const alone = (participants.data?.length ?? 1) <= 1;
  // 서버에는 확정 단계가 없어(코스는 계속 고침) 준비 흐름의 끝은 홈으로 돌아가는 것으로 맺습니다.
  const finishPrep = () => {
    haptics.confirm();
    toast("여행 준비를 마쳤어요", { description: "코스는 여행 전까지 언제든 고칠 수 있어요." });
    router.dismissTo("/(tabs)");
  };
  let cta: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean } | null = null;
  /** 혼자인 여행을 다시 열었을 때 작은 "친구 초대하기" 링크 (참여자 화면에는 초대 입구가 없습니다) */
  let inviteLink = false;
  if (!data) {
    if (!regionSigCd) cta = { label: "랜덤으로 여행지 정하기", onPress: () => pickRegion.mutate(), loading: pickRegion.isPending };
    else if (canGenerate) cta = { label: generate.isPending ? "코스를 만드는 중이에요" : "첫 코스 만들기", onPress: () => runGenerate(), loading: generate.isPending };
  } else if (preparing) {
    // 3/4에서 넘어왔으면 친구 초대로 되돌려 보내지 않습니다 (혼자 가기·초대 후 응답 대기 모두).
    // 변경 수에는 내가 직접 바꾼 것도 들어가므로 변경이 있어도 준비를 끝맺습니다 (변경은 '변경 표시' 탭에서 봄).
    cta = { label: "여행 준비 완료", onPress: finishPrep };
  } else if (alone) {
    // 혼자인 여행에는 '친구 변경'을 권하지 않습니다.
    inviteLink = true;
  } else if (tab === "all") {
    cta = { label: "친구 변경 확인하기", onPress: () => switchTab("changes") };
  } else {
    cta = { label: "전체 코스로 돌아가기", onPress: () => switchTab("all") };
  }

  return (
    <Screen>
      <TopBar
        title="함께 만드는 코스"
        onBack={goBack}
        right={
          <PressableScale onPress={() => shareRef.current?.present()} hitSlop={10} accessibilityRole="button" accessibilityLabel="코스 공유하기" accessibilityHint="로그인 없이 볼 수 있는 읽기 전용 링크를 보내요">
            <Icons.Share width={20} height={20} />
          </PressableScale>
        }
      />
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        onContentSizeChange={(_w, h) => contentHeight.set(h)}
        showsVerticalScrollIndicator={false}
      >
        <CourseHeader title={title} startDate={startDate} endDate={endDate} travelers={travelers} onSettings={openParticipants} line={headerLine} />

        {!data ? (
          !regionSigCd && !context.isPending ? (
            <Animated.View entering={FadeInDown.springify().damping(motion.spring.gentle.damping)} style={styles.noRegion}>
              <AppText variant="label" color="darkgreen">
                아직 여행지가 정해지지 않았어요
              </AppText>
              <AppText variant="small13" color="darkgreen">
                핀을 꽂아 이 여행의 지역을 정하면 첫 코스를 만들 수 있어요.
              </AppText>
              <Button label="지도에서 직접 고르기" variant="secondary" height={44} onPress={() => router.navigate("/(tabs)/travel")} />
            </Animated.View>
          ) : (
            <GenerateCourseView
              myNickname={me?.nickname ?? "나"}
              regionShort={regionShort}
              days={startDate ? diffDays(startDate, endDate) + 1 : 1}
              generating={generate.isPending}
              canGenerate={canGenerate}
              creatorNickname={creator?.nickname ?? null}
            />
          )
        ) : (
          <CourseBody
            course={data}
            transport={transport}
            tab={tab}
            onTabChange={setTab}
            dayIndex={dayIndex}
            onDayChange={setDayIndex}
            statusOverride={generate.isPending ? "새 코스를 만드는 중이에요…" : status}
            onOpenDetail={openDetail}
            edit={
              data.myRole === "PARTICIPANT"
                ? {
                    scroll: { ref: scrollRef, offset, contentHeight },
                    onEditPlace: (itemId) => router.push({ pathname: "/trip/[tripId]/place/[itemId]", params: { tripId: String(tripId), itemId } }),
                    onPickMeal: (itemId) => router.push({ pathname: "/trip/[tripId]/meal/[itemId]", params: { tripId: String(tripId), itemId } }),
                    onMove,
                    onDragStart: () => {
                      dragging.current = true;
                      flash("이동 중 · 하루 안에서 순서를 바꿀 수 있어요.", true);
                    },
                    onRestore,
                    restoringId,
                    onOpenMap: (d) => router.push({ pathname: "/trip/[tripId]/map", params: { tripId: String(tripId), dayIndex: String(d) } }),
                    onAddPlace: (d) => router.push({ pathname: "/trip/[tripId]/add", params: { tripId: String(tripId), dayIndex: String(d) } }),
                  }
                : undefined
            }
            footer={
              canRegenerate(data.myRole) ? (
                <PressableScale onPress={() => setConfirmRegenerate(true)} style={styles.regenerate} accessibilityRole="button" accessibilityLabel="코스 다시 만들기">
                  <Icons.Refresh width={16} height={16} />
                  <AppText variant="small13Medium" color="muted">
                    내 취향으로 코스 다시 만들기
                  </AppText>
                </PressableScale>
              ) : null
            }
          />
        )}
      </Animated.ScrollView>

      {cta ? (
        <BottomCTA>
          <Button label={cta.label} onPress={cta.onPress} loading={cta.loading} disabled={cta.disabled} rightIcon={cta.loading ? undefined : <Icons.ArrowRight width={20} height={20} />} />
        </BottomCTA>
      ) : inviteLink ? (
        <BottomCTA helper="친구 초대하기" onHelperPress={() => router.push({ pathname: "/trip/[tripId]/invite", params: { tripId: String(tripId), from: "course" } })}>
          {null}
        </BottomCTA>
      ) : null}

      <ConfirmDialog
        visible={confirmRegenerate}
        title="코스를 다시 만들까요?"
        body="내 취향으로 새 코스를 만들어요. 다른 참여자의 편집과 식당 선택도 사라져요."
        confirmLabel="다시 만들기"
        destructive
        loading={generate.isPending}
        onCancel={() => setConfirmRegenerate(false)}
        onConfirm={() => runGenerate(true)}
      />
      <CourseShareSheet sheetRef={shareRef} tripId={tripId} title={title} />
      <AttractionDetailSheet sheetRef={detailRef} attractionId={detailId} />
    </Screen>
  );
}

const canRegenerate = (role: "PARTICIPANT" | "VIEWER") => role === "PARTICIPANT";

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[24], paddingBottom: space[32], gap: space[24] },
  noRegion: { backgroundColor: colors.mint, borderRadius: 16, padding: space[16], gap: space[8] },
  regenerate: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44 },
});
