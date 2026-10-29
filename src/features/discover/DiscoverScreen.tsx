import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { Easing, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { onboardingApi, regionApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { DrawCondition, DrawResult } from "@/api/types";
import { isMbtiType, MBTI_PROFILES } from "@/features/mbti";
import { haptics } from "@/lib/haptics";
import { colors, motion, space } from "@/theme";

import { ConditionCard } from "./components/ConditionCard";
import { DestinationSheet, CARD_STALE_TIME } from "./components/DestinationSheet";
import { DiscoverActions } from "./components/DiscoverActions";
import { DiscoverAppBar } from "./components/DiscoverAppBar";
import { DiscoverBackground } from "./components/DiscoverBackground";
import { DiscoverIntro } from "./components/DiscoverIntro";
import { IntroVeil, MapLayer, type MapOutline, type MapStage, PinLayer } from "./components/DiscoveryMap";
import { RegionPickerSheet } from "./components/RegionPickerSheet";
import { useDrawableRegions } from "./hooks/useDrawableRegions";
import { useMapWave } from "./hooks/useMapWave";
import { usePinChoreography } from "./hooks/usePinChoreography";
import { computeDiscoverGeometry } from "./lib/geometry";
import { regionShape } from "./lib/koreaMap";
import { asManual, type DiscoveredRegion, fromDraw, type MapPoint, type MapRegion } from "./lib/regions";
import { useDiscoverDraw } from "./store";

/** 꾹 누를 때 힘이 다 모이기까지 · 다시 뽑기처럼 자동으로 던질 때 힘 모으는 시간 */
const CHARGE_MS = 1100;
const AUTO_CHARGE_MS = 650;
/** 힘 모으는 동안 진동 간격 */
const TICK_MS = 150;
/** 핀이 닿은 뒤 시트가 올라오기까지 (지도 확대가 먼저 시작되도록) */
const SHEET_DELAY_MS = 220;
/** 손을 뗐는데 아직 결과가 없으면 핀이 이 자리 위 공중에서 기다립니다 (내 취향 뽑기는 2초쯤 걸림) */
const HOVER_POINT: MapPoint = { u: 0.5, v: 0.42 };

type Outcome = { ok: true; value: DrawResult } | { ok: false; error: unknown };
/** 꾹 누르기 시작할 때 보낸 추첨 요청 (손을 뗄 때쯤이면 대개 답이 와 있습니다) */
type PendingDraw = { id: number; conditional: boolean; outcome: Outcome | null; request: Promise<void> };

/** 성향 한 줄 — "낭만적인 기록가에게 어울리는 느긋한 여행" (P는 느긋한, J는 알찬: 서버도 J/P로 일정 밀도를 정합니다) */
function usePersonaLine() {
  const onboarding = useQuery({ queryKey: queryKeys.myOnboarding, queryFn: onboardingApi.me, staleTime: 5 * 60_000 });
  const code = onboarding.data?.submission?.mbtiCode;
  if (!isMbtiType(code)) return null;
  return `${MBTI_PROFILES[code].name}에게 어울리는 ${code.endsWith("J") ? "알찬" : "느긋한"} 여행`;
}

/**
 * 여행 탭 — 피그마 B1 기본 지도 → B2 핀 모드 → B3 지역 발견 (→ B4 /region/[sigCd]).
 * 지역 먼저(D1): 서버 POST /regions/draw가 1일 기준으로 뽑습니다(저장 안 함).
 * 핀 꽂기를 꾹 누르면 그때 요청을 보내고 지도가 위에서 아래로 출렁이며 힘이 모이고,
 * 손을 떼면 핀이 다트처럼 날아가 뽑힌 시군구에 꽂힙니다(충격이 퍼지고 그 시군구 경계가 그려짐).
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
  const { wave, startCharge, calm, hit, track, stop: stopWave } = useMapWave();
  const initial = useDiscoverDraw.getState().result;
  const zoom = useSharedValue(restored ? 2 : 0);
  const focusU = useSharedValue(initial?.u ?? 0.5);
  const focusV = useSharedValue(initial?.v ?? 0.5);
  const sheet = useSharedValue(restored ? 1 : 0);
  const outlineDraw = useSharedValue(restored ? 1 : 0);
  const stage = useMemo<MapStage>(() => ({ zoom, focusU, focusV }), [zoom, focusU, focusV]);
  const outlineShape = result ? regionShape(result.sigCd) : undefined;
  const outlineId = result?.sigCd ?? "";
  const outline = useMemo<MapOutline>(() => (outlineShape ? { id: outlineId, shape: outlineShape, draw: outlineDraw } : null), [outlineId, outlineShape, outlineDraw]);
  const [holding, setHolding] = useState(false);

  const drawIdRef = useRef(0);
  const pending = useRef<PendingDraw | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const pickerRef = useRef<BottomSheetModal>(null);
  const pendingPick = useRef<MapRegion | null>(null);
  /** 목록 시트의 검색창이 키보드를 띄우면(adjustResize) 화면 높이가 줄어드는데, 그동안 지도가 움직이지 않게 무시합니다. */
  const pickerOpen = useRef(false);

  const stopTicks = () => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  };
  useEffect(() => stopTicks, []);

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

  /** 핀이 날아갈 시군구 — 핀이 그 조각과 함께 들썩이도록 미리 알려 둡니다. */
  const aim = (target: DiscoveredRegion) => {
    prefetchRegion(target.sigCd);
    track(regionShape(target.sigCd)?.piece ?? -1);
  };

  /** B3: 핀이 꽂힌 자리에서 충격이 퍼지고, 시군구 경계가 그려지며 지도가 확대되고 시트가 올라옵니다. */
  const showFound = (found: DiscoveredRegion) => {
    haptics.thud();
    hit(found.u, found.v, regionShape(found.sigCd)?.piece ?? -1);
    focusU.set(found.u);
    focusV.set(found.v);
    useDiscoverDraw.getState().land(found);
    zoom.set(withSpring(2, motion.spring.gentle));
    choreo.showResult();
    outlineDraw.set(0);
    outlineDraw.set(withDelay(120, withTiming(1, { duration: 820, easing: Easing.inOut(Easing.cubic) })));
    sheet.set(withDelay(SHEET_DELAY_MS, withSpring(1, motion.spring.gentle)));
  };

  /** 이전 결과(시트·라벨·경계선)를 거둡니다. */
  const hideFound = () => {
    sheet.set(withTiming(0, motion.timing.base));
    outlineDraw.set(withTiming(0, motion.timing.fast));
    choreo.hideResult();
  };

  /** 추첨 실패: 직전 결과가 있으면 그 화면으로, 없으면 처음 지도로 */
  const fail = (error: unknown, conditional: boolean) => {
    haptics.reject();
    stopTicks();
    setHolding(false);
    calm();
    const s = useDiscoverDraw.getState();
    s.cancel();
    if (s.result) {
      choreo.placeAt(s.result);
      zoom.set(withSpring(2, motion.spring.gentle));
      sheet.set(withSpring(1, motion.spring.gentle));
      outlineDraw.set(withTiming(1, motion.timing.base));
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

  /** 힘 모으기 시작: 추첨 요청을 보내고, 핀을 point(화면 좌표) 위에 들고, 지도를 출렁입니다. */
  const beginThrow = (point: { x: number; y: number }, chargeMs: number) => {
    const id = ++drawIdRef.current;
    hideFound();
    const chosen: DrawCondition[] = useDiscoverDraw.getState().conditions;
    const conditional = chosen.length > 0;
    const entry: PendingDraw = { id, conditional, outcome: null, request: Promise.resolve() };
    entry.request = regionApi.draw(conditional ? { mode: "CONDITIONAL", conditions: chosen } : { mode: "RANDOM" }).then(
      (value) => {
        entry.outcome = { ok: true, value };
      },
      (error: unknown) => {
        entry.outcome = { ok: false, error };
      },
    );
    pending.current = entry;
    choreo.hold(point.x, point.y, chargeMs);
    startCharge(chargeMs);
    stopTicks();
    ticker.current = setInterval(haptics.tick, TICK_MS);
    return id;
  };

  /** 손을 뗌: 결과가 와 있으면 곧장 그 시군구로, 아직이면 공중에서 기다렸다가 떨어집니다. */
  const releaseThrow = async (id: number) => {
    const entry = pending.current;
    if (!entry || entry.id !== id || id !== drawIdRef.current) return;
    stopTicks();
    setHolding(false);
    const s = useDiscoverDraw.getState();
    if (s.phase !== "drawing") s.start("random");
    zoom.set(withSpring(1, motion.spring.gentle));
    calm();

    const toTarget = (outcome: Outcome | null) => {
      if (!outcome || !outcome.ok) {
        fail(outcome?.error, entry.conditional);
        return null;
      }
      const target = fromDraw(outcome.value);
      if (outcome.value.ignoredConditions.some((c) => c.condition === "MY_TASTE")) {
        toast("취향 분석이 아직 끝나지 않아 완전 랜덤으로 뽑았어요");
      }
      aim(target);
      return target;
    };

    if (entry.outcome) {
      const target = toTarget(entry.outcome);
      if (!target) return;
      await choreo.throwTo(target);
      if (id === drawIdRef.current) showFound(target);
      return;
    }
    track(-1);
    await choreo.throwTo(HOVER_POINT, { hover: true });
    await entry.request;
    if (id !== drawIdRef.current) return;
    const target = toTarget(entry.outcome);
    if (!target) return;
    await choreo.land(target);
    if (id === drawIdRef.current) showFound(target);
  };

  // 핀 꽂기 버튼(꾹 누르기): 핀은 버튼 위쪽 가운데(엄지 바로 위)에서 나타납니다. 버튼 오른쪽엔 조건 버튼(46)이 있습니다.
  const onHoldStart = () => {
    if (!geo || useDiscoverDraw.getState().phase !== "idle") return;
    setHolding(true);
    beginThrow({ x: (geo.width - 46 - space[8]) / 2, y: geo.actionsTop - 4 }, CHARGE_MS);
  };
  const onHoldRelease = () => void releaseThrow(drawIdRef.current);
  const onShortPress = () =>
    toast("핀 꽂기를 꾹 눌렀다가 놓아 주세요", { description: "누르는 동안 지도가 출렁이며 힘이 모이고, 손을 떼면 핀이 날아가요." });

  /** 다시 뽑기·조건 적용: 화면 아래에서 잠깐 힘을 모았다가 자동으로 던집니다. */
  const autoThrow = () => {
    if (!geo) return;
    useDiscoverDraw.getState().start("random");
    zoom.set(withSpring(1, motion.spring.gentle));
    const id = beginThrow({ x: geo.width / 2, y: geo.height - 28 }, AUTO_CHARGE_MS);
    setTimeout(() => void releaseThrow(id), AUTO_CHARGE_MS);
  };

  /** 직접 고르기: 목록에서 고른 지역 위로 핀이 곧장 떨어집니다. */
  const dropOn = async (region: MapRegion) => {
    const id = ++drawIdRef.current;
    hideFound();
    useDiscoverDraw.getState().start("manual");
    zoom.set(withSpring(1, motion.spring.gentle));
    const target = asManual(region);
    aim(target);
    await choreo.land(target);
    if (id === drawIdRef.current) showFound(target);
  };

  const backToIdle = () => {
    drawIdRef.current += 1;
    stopTicks();
    setHolding(false);
    stopWave();
    choreo.reset();
    hideFound();
    zoom.set(withSpring(0, motion.spring.gentle));
    useDiscoverDraw.getState().clear();
  };

  // B4 "다시 뽑기" → 이 탭으로 돌아오면 다시 뽑습니다.
  const lastRedraw = useRef(redrawRequest);
  useEffect(() => {
    if (redrawRequest === lastRedraw.current) return;
    lastRedraw.current = redrawRequest;
    autoThrow();
    // autoThrow는 매 렌더 새 함수라 요청 값이 바뀔 때만 부릅니다.
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
    if (picked) void dropOn(picked);
  };

  const applyConditions = (next: DrawCondition[]) => {
    useDiscoverDraw.getState().setConditions(next);
    setConditionsOpen(false);
    autoThrow();
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
      {geo ? <MapLayer geo={geo} stage={stage} wave={wave} outline={outline} accessibilityLabel={mapLabel} /> : null}
      {geo ? <IntroVeil geo={geo} zoom={zoom} /> : null}
      {geo ? <PinLayer geo={geo} stage={stage} pin={choreo.pin} wave={wave} label={result?.name ?? null} /> : null}

      <View style={{ paddingTop: insets.top + 6 }} pointerEvents="box-none">
        <DiscoverAppBar />
        <DiscoverIntro phase={phase} mode={mode} resultName={result?.name ?? null} conditional={conditions.length > 0} holding={holding} />
      </View>

      {geo ? (
        <DiscoverActions
          top={geo.actionsTop}
          visible={phase === "idle"}
          conditional={conditions.length > 0}
          holding={holding}
          power={choreo.pin.power}
          onHoldStart={onHoldStart}
          onRelease={onHoldRelease}
          onShortPress={onShortPress}
          onManual={openPicker}
          onConditions={() => setConditionsOpen(true)}
        />
      ) : null}

      <DestinationSheet progress={sheet} region={result} personaLine={personaLine} onRedraw={autoThrow} onExplore={explore} />

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
