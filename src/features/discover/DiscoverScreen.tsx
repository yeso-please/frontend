import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { onboardingApi, regionApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { DrawCondition, DrawResult } from "@/api/types";
import { isMbtiType, MBTI_PROFILES } from "@/features/mbti";
import { haptics } from "@/lib/haptics";
import { colors, motion } from "@/theme";

import { ConditionCard } from "./components/ConditionCard";
import { DestinationSheet, CARD_STALE_TIME } from "./components/DestinationSheet";
import { DiscoverActions } from "./components/DiscoverActions";
import { DiscoverAppBar } from "./components/DiscoverAppBar";
import { DiscoverBackground } from "./components/DiscoverBackground";
import { DiscoverIntro } from "./components/DiscoverIntro";
import { IntroVeil, MapLayer, type MapStage, PinLayer } from "./components/DiscoveryMap";
import { RegionPickerSheet } from "./components/RegionPickerSheet";
import { useDrawableRegions } from "./hooks/useDrawableRegions";
import { usePinChoreography } from "./hooks/usePinChoreography";
import { computeDiscoverGeometry } from "./lib/geometry";
import { asManual, type DiscoveredRegion, fromDraw, type MapPoint, type MapRegion, pickHopSpots } from "./lib/regions";
import { useDiscoverDraw } from "./store";

/** 서버가 답하기 전 한 번에 들르는 자리 수 (답이 늦으면 몇 자리 더 들릅니다) */
const HOP_COUNT = 3;
/** 들르기를 더 이어 가는 최대 횟수 — 넘으면 요청이 끝나기를 그냥 기다립니다 (요청 자체에 시간 제한이 있음) */
const MAX_SEARCH_ROUNDS = 6;
/** 핀이 닿은 뒤 시트가 올라오기까지 (지도 확대가 먼저 시작되도록) */
const SHEET_DELAY_MS = 220;

type Outcome = { ok: true; value: DrawResult } | { ok: false; error: unknown };

/** 성향 한 줄 — "낭만적인 기록가에게 어울리는 느긋한 여행" (P는 느긋한, J는 알찬: 서버도 J/P로 일정 밀도를 정합니다) */
function usePersonaLine() {
  const onboarding = useQuery({ queryKey: queryKeys.myOnboarding, queryFn: onboardingApi.me, staleTime: 5 * 60_000 });
  const code = onboarding.data?.submission?.mbtiCode;
  if (!isMbtiType(code)) return null;
  return `${MBTI_PROFILES[code].name}에게 어울리는 ${code.endsWith("J") ? "알찬" : "느긋한"} 여행`;
}

/**
 * 여행 탭 — 피그마 B1 기본 지도 → B2 핀 모드 → B3 지역 발견 (→ B4 /region/[sigCd]).
 * 지역 먼저(D1): 서버 POST /regions/draw가 1일 기준으로 뽑고(저장 안 함), 핀은 그동안 지도 위를 들르다 결과로 날아갑니다.
 */
export function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const geo = useMemo(() => (size ? computeDiscoverGeometry(size.width, size.height, insets.top) : null), [size, insets.top]);

  const regions = useDrawableRegions();
  const personaLine = usePersonaLine();
  const phase = useDiscoverDraw((s) => s.phase);
  const mode = useDiscoverDraw((s) => s.mode);
  const result = useDiscoverDraw((s) => s.result);
  const conditions = useDiscoverDraw((s) => s.conditions);
  const redrawRequest = useDiscoverDraw((s) => s.redrawRequest);
  const [conditionsOpen, setConditionsOpen] = useState(false);

  // 탭을 오가거나 B4에서 돌아와도 마지막 결과를 그대로 보여 줍니다 (다시 뽑기 전까지 초기화하지 않음).
  const [restored] = useState(() => {
    const s = useDiscoverDraw.getState();
    return s.phase !== "idle" && !!s.result;
  });
  const choreo = usePinChoreography();
  const initial = useDiscoverDraw.getState().result;
  const zoom = useSharedValue(restored ? 2 : 0);
  const focusU = useSharedValue(initial?.u ?? 0.5);
  const focusV = useSharedValue(initial?.v ?? 0.5);
  const sheet = useSharedValue(restored ? 1 : 0);
  const stage = useMemo<MapStage>(() => ({ zoom, focusU, focusV }), [zoom, focusU, focusV]);

  const drawIdRef = useRef(0);
  const pickerRef = useRef<BottomSheetModal>(null);
  const pendingPick = useRef<MapRegion | null>(null);
  /** 목록 시트의 검색창이 키보드를 띄우면(adjustResize) 화면 높이가 줄어드는데, 그동안 지도가 움직이지 않게 무시합니다. */
  const pickerOpen = useRef(false);

  useEffect(() => {
    const s = useDiscoverDraw.getState();
    // 연출 도중 화면이 다시 만들어졌다면 직전 결과(없으면 처음 지도)로 돌아갑니다.
    if (s.phase === "drawing") s.cancel();
    if (s.result && useDiscoverDraw.getState().phase === "found") choreo.placeAt(s.result);
    // 처음 한 번만 복원합니다 (choreo는 매 렌더 새 객체라 의존성에 넣지 않습니다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prefetchRegion = (sigCd: string) => {
    void queryClient.prefetchQuery({ queryKey: queryKeys.regionCard(sigCd), queryFn: () => regionApi.card(sigCd), staleTime: CARD_STALE_TIME });
    void queryClient.prefetchQuery({ queryKey: queryKeys.regionMatch(sigCd), queryFn: () => regionApi.match(sigCd), staleTime: CARD_STALE_TIME });
  };

  /** B3: 핀이 꽂힌 지역으로 지도를 확대하고 시트를 올립니다. */
  const showFound = (found: DiscoveredRegion) => {
    haptics.thud();
    focusU.set(found.u);
    focusV.set(found.v);
    useDiscoverDraw.getState().land(found);
    zoom.set(withSpring(2, motion.spring.gentle));
    choreo.showResult();
    sheet.set(withDelay(SHEET_DELAY_MS, withSpring(1, motion.spring.gentle)));
  };

  /** 추첨 실패: 직전 결과가 있으면 그 화면으로, 없으면 처음 지도로 */
  const fail = (error: unknown, conditional: boolean) => {
    haptics.reject();
    const s = useDiscoverDraw.getState();
    s.cancel();
    if (s.result) {
      choreo.placeAt(s.result);
      zoom.set(withSpring(2, motion.spring.gentle));
      sheet.set(withSpring(1, motion.spring.gentle));
    } else {
      choreo.reset();
      zoom.set(withSpring(0, motion.spring.gentle));
    }
    if (isApiError(error, "DRAW_NO_ELIGIBLE_REGION")) {
      toast(conditional ? "조건에 맞는 지역이 없어요" : "지금은 뽑을 수 있는 지역이 없어요", {
        description: conditional ? "조건을 끄고 완전 랜덤으로 다시 꽂아 보세요." : "잠시 후 다시 시도해 주세요.",
      });
    } else {
      toast.error("핀을 꽂지 못했어요", { description: errorMessage(error) });
    }
  };

  const runDraw = async (manualPick?: MapRegion) => {
    const id = ++drawIdRef.current;
    const s = useDiscoverDraw.getState();
    const from: MapPoint | null = s.phase === "found" && s.result ? s.result : null;
    sheet.set(withTiming(0, motion.timing.base));
    s.start(manualPick ? "manual" : "random");
    zoom.set(withSpring(1, motion.spring.gentle));

    if (manualPick) {
      const target = asManual(manualPick);
      prefetchRegion(target.sigCd);
      choreo.hideResult();
      await choreo.land(target);
      if (id === drawIdRef.current) showFound(target);
      return;
    }

    const chosen: DrawCondition[] = s.conditions;
    const conditional = chosen.length > 0;
    const pending: { outcome: Outcome | null } = { outcome: null };
    const request = regionApi.draw(conditional ? { mode: "CONDITIONAL", conditions: chosen } : { mode: "RANDOM" }).then(
      (value) => {
        pending.outcome = { ok: true, value };
      },
      (error: unknown) => {
        pending.outcome = { ok: false, error };
      },
    );

    // 서버가 답할 때까지 지도 위를 들릅니다 (동작 줄이기면 들르지 않고 기다립니다).
    let prev = from;
    for (let round = 0; round < MAX_SEARCH_ROUNDS && !choreo.reducedMotion; round++) {
      const spots = pickHopSpots(regions.eligible, prev, HOP_COUNT);
      haptics.tick();
      await choreo.search(spots);
      if (id !== drawIdRef.current) return;
      prev = spots[spots.length - 1];
      if (pending.outcome) break;
    }
    await request;
    if (id !== drawIdRef.current) return;

    const outcome = pending.outcome as Outcome | null;
    if (!outcome || !outcome.ok) {
      fail(outcome?.error, conditional);
      return;
    }
    const target = fromDraw(outcome.value);
    prefetchRegion(target.sigCd);
    if (outcome.value.ignoredConditions.some((c) => c.condition === "MY_TASTE")) {
      toast("취향 분석이 아직 끝나지 않아 완전 랜덤으로 뽑았어요");
    }
    await choreo.land(target);
    if (id === drawIdRef.current) showFound(target);
  };

  const backToIdle = () => {
    drawIdRef.current += 1;
    choreo.reset();
    sheet.set(withTiming(0, motion.timing.base));
    zoom.set(withSpring(0, motion.spring.gentle));
    useDiscoverDraw.getState().clear();
  };

  // B4 "다시 뽑기" → 이 탭으로 돌아오면 다시 뽑습니다.
  const lastRedraw = useRef(redrawRequest);
  useEffect(() => {
    if (redrawRequest === lastRedraw.current) return;
    lastRedraw.current = redrawRequest;
    void runDraw();
    // runDraw는 매 렌더 새 함수라 요청 값이 바뀔 때만 부릅니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redrawRequest]);

  // 결과·핀 모드에서 Android 뒤로가기는 처음 지도로 돌아갑니다.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (useDiscoverDraw.getState().phase === "idle" || conditionsOpen) {
          if (conditionsOpen) setConditionsOpen(false);
          return conditionsOpen;
        }
        backToIdle();
        return true;
      });
      return () => sub.remove();
      // backToIdle은 shared value·ref만 만지므로 매 렌더 다시 등록할 필요가 없습니다.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conditionsOpen]),
  );

  const explore = () => {
    const found = useDiscoverDraw.getState().result;
    if (!found) return;
    router.push({
      pathname: "/region/[sigCd]",
      params: { sigCd: found.sigCd, selection: found.selection, maxNights: found.maxNights == null ? "" : String(found.maxNights) },
    });
  };

  // 직접 고르기: 목록 시트가 내려간 뒤 핀을 바로 떨어뜨립니다 (들르기 연출 없음).
  const openPicker = () => {
    pickerOpen.current = true;
    pickerRef.current?.present();
  };
  const selectFromPicker = (region: MapRegion) => {
    pendingPick.current = region;
    pickerRef.current?.dismiss();
  };
  const handlePickerDismiss = () => {
    pickerOpen.current = false;
    const picked = pendingPick.current;
    pendingPick.current = null;
    if (picked) void runDraw(picked);
  };

  const applyConditions = (next: DrawCondition[]) => {
    useDiscoverDraw.getState().setConditions(next);
    setConditionsOpen(false);
    void runDraw();
  };

  const mapLabel =
    phase === "found" && result ? `한국 지도, ${result.name}에 핀이 꽂혀 있어요` : phase === "drawing" ? "한국 지도, 핀이 여행지를 찾고 있어요" : "한국 지도";

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (pickerOpen.current && size) return;
        setSize({ width, height });
      }}
    >
      <DiscoverBackground />
      {geo ? <MapLayer geo={geo} stage={stage} accessibilityLabel={mapLabel} /> : null}
      {geo ? <IntroVeil geo={geo} zoom={zoom} /> : null}
      {geo ? <PinLayer geo={geo} stage={stage} pin={choreo.pin} label={result?.name ?? null} /> : null}

      <View style={{ paddingTop: insets.top + 6 }} pointerEvents="box-none">
        <DiscoverAppBar />
        <DiscoverIntro phase={phase} mode={mode} resultName={result?.name ?? null} conditional={conditions.length > 0} />
      </View>

      {geo ? (
        <DiscoverActions
          top={geo.actionsTop}
          visible={phase === "idle"}
          conditional={conditions.length > 0}
          onDraw={() => void runDraw()}
          onManual={openPicker}
          onConditions={() => setConditionsOpen(true)}
        />
      ) : null}

      <DestinationSheet progress={sheet} region={result} personaLine={personaLine} onRedraw={() => void runDraw()} onExplore={explore} />

      {conditionsOpen && geo ? (
        <ConditionCard top={geo.introTop + 152} conditions={conditions} onClose={() => setConditionsOpen(false)} onApply={applyConditions} />
      ) : null}

      <RegionPickerSheet
        ref={pickerRef}
        regions={regions.eligible}
        isPending={regions.isPending}
        error={regions.isError ? regions.error : null}
        onRetry={() => regions.refetch()}
        onSelect={selectFromPicker}
        onDismiss={handlePickerDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // 탭바 위 영역. 내려간 시트가 탭바 쪽으로 비어져 나오지 않게 잘라 냅니다.
  root: { flex: 1, backgroundColor: colors.white, overflow: "hidden" },
});
