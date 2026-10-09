import type BottomSheet from "@gorhom/bottom-sheet";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { regionApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import { haptics } from "@/lib/haptics";
import { useTripDraft } from "@/store/tripDraft";
import { colors, motion } from "@/theme";

import { CARD_STALE_TIME, DestinationSheet } from "./components/DestinationSheet";
import { MapLayer, type MapStage, PinLayer } from "./components/DiscoveryMap";
import { HomeActions } from "./components/HomeActions";
import { HomeAppBar } from "./components/HomeAppBar";
import { HomeBackground } from "./components/HomeBackground";
import { HomeIntro } from "./components/HomeIntro";
import { RegionPickerSheet } from "./components/RegionPickerSheet";
import { useDrawableRegions } from "./hooks/useDrawableRegions";
import { usePinChoreography } from "./hooks/usePinChoreography";
import { computeFocusShift, computeHomeGeometry, estimateFoundIntroHeight, SHEET } from "./lib/geometry";
import { type MapRegion, pickHopSpots, pickRandom } from "./lib/regions";
import { type DrawMode, useHomeDraw } from "./store";

/** 첫 착지 + 들르는 자리 수 (핀이 3곳을 거쳐 최종 지역으로) */
const HOP_COUNT = 3;
/** 핀이 닿은 뒤 시트가 올라오기까지 (라벨이 먼저 톡 튀어나오도록) */
const SHEET_DELAY_MS = 180;

/**
 * 홈 탭 — 피그마 Home discovery 01 → 02 → 03 ⇄ 04.
 * 핀 먼저: 앱이 GET /regions?days=1 의 추첨 가능 지역 중 하나를 고르고, 여행은 "OO으로 여행 만들기" 뒤에 만듭니다.
 */
export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const geo = useMemo(() => (size ? computeHomeGeometry(size.width, size.height, insets.top) : null), [size, insets.top]);

  const regions = useDrawableRegions();
  const phase = useHomeDraw((s) => s.phase);
  const mode = useHomeDraw((s) => s.mode);
  const target = useHomeDraw((s) => s.target);
  const result = useHomeDraw((s) => s.result);

  // 탭을 오가거나 다시 그려져도 마지막 결과를 그대로 보여 줍니다 (다시 뽑기 전까지 초기화하지 않음).
  const [restored] = useState(() => useHomeDraw.getState().phase !== "idle" && !!useHomeDraw.getState().target);
  const choreo = usePinChoreography();
  const progress = useSharedValue(restored ? 1 : 0);
  const sheetIndex = useSharedValue(restored ? 0 : -1);
  const focusCompact = useSharedValue(0);
  const focusExpanded = useSharedValue(0);
  const stage = useMemo<MapStage>(
    () => ({ progress, sheetIndex, focusCompact, focusExpanded }),
    [progress, sheetIndex, focusCompact, focusExpanded],
  );
  const [expandedHeight, setExpandedHeight] = useState(SHEET.compact + SHEET.minExpandedExtra);

  const sheetRef = useRef<BottomSheet>(null);
  const pickerRef = useRef<BottomSheetModal>(null);
  const drawIdRef = useRef(0);
  const sheetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPick = useRef<MapRegion | null>(null);
  /** 목록 시트의 검색창이 키보드를 띄우면(adjustResize) 화면 높이가 줄어드는데, 그동안 지도가 움직이지 않게 무시합니다. */
  const pickerOpen = useRef(false);

  useEffect(() => {
    const s = useHomeDraw.getState();
    if (s.phase !== "idle" && s.target) {
      // 연출 도중 화면이 다시 만들어졌다면 결과 상태로 바로 갑니다.
      if (s.phase === "drawing") s.land();
      choreo.placeAt(s.target);
    }
    return () => {
      if (sheetTimer.current) clearTimeout(sheetTimer.current);
    };
    // 처음 한 번만 복원합니다 (choreo는 매 렌더 새 객체라 의존성에 넣지 않습니다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 결과 지역이 헤드라인과 시트 사이에 보이도록 지도 초점(위아래 이동)을 계산합니다.
  useEffect(() => {
    if (!geo || !target) return;
    const introBottom = geo.introTop + estimateFoundIntroHeight(target.name, geo.width);
    focusCompact.set(withTiming(computeFocusShift(geo, target.v, introBottom, SHEET.compact), motion.timing.slow));
    focusExpanded.set(withTiming(computeFocusShift(geo, target.v, introBottom, expandedHeight, SHEET.expandedMapScale), motion.timing.slow));
  }, [geo, target, expandedHeight, focusCompact, focusExpanded]);

  const prefetchCard = (sigCd: string) =>
    queryClient.prefetchQuery({ queryKey: queryKeys.regionCard(sigCd), queryFn: () => regionApi.card(sigCd), staleTime: CARD_STALE_TIME });

  const handleLanded = (drawId: number) => {
    if (drawId !== drawIdRef.current) return;
    haptics.thud();
    useHomeDraw.getState().land();
    choreo.showResult();
    if (sheetTimer.current) clearTimeout(sheetTimer.current);
    sheetTimer.current = setTimeout(() => sheetRef.current?.snapToIndex(0), SHEET_DELAY_MS);
  };

  const begin = (next: MapRegion, drawMode: DrawMode) => {
    const drawId = ++drawIdRef.current;
    const s = useHomeDraw.getState();
    const from = s.phase === "found" && s.target ? s.target : null;
    const spots = drawMode === "random" ? pickHopSpots(regions.eligible, from, next, HOP_COUNT) : [];
    prefetchCard(next.sigCd);
    s.start(next, drawMode);
    progress.set(withSpring(1, motion.spring.gentle));
    choreo.run({
      spots,
      target: next,
      onHop: () => {
        if (drawId === drawIdRef.current) haptics.tick();
      },
      onLand: () => handleLanded(drawId),
    });
  };

  const drawRandom = () => {
    if (regions.isPending) return;
    if (regions.eligible.length === 0) {
      haptics.reject();
      toast("지금은 뽑을 수 있는 지역이 없어요");
      return;
    }
    // 백엔드 추첨과 같이 중복을 허용하는 무작위 선택입니다.
    begin(pickRandom(regions.eligible), "random");
  };

  const redraw = () => {
    if (sheetTimer.current) clearTimeout(sheetTimer.current);
    sheetRef.current?.close();
    drawRandom();
  };

  const createTrip = () => {
    const picked = useHomeDraw.getState().result;
    if (!picked) return;
    useTripDraft.getState().setRegion({
      sigCd: picked.sigCd,
      province: picked.province,
      city: picked.city,
      centerLat: picked.centerLat,
      centerLng: picked.centerLng,
    });
    router.push("/trip/prepare");
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
    if (picked) begin(picked, "manual");
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
      <HomeBackground />
      {geo ? <MapLayer geo={geo} stage={stage} accessibilityLabel={mapLabel} /> : null}

      <View style={{ paddingTop: insets.top + 6 }} pointerEvents="box-none">
        <HomeAppBar onBellPress={() => toast("알림은 곧 준비돼요")} />
        <HomeIntro phase={phase} mode={mode} resultName={result?.name ?? null} />
      </View>

      {geo ? <PinLayer geo={geo} stage={stage} pin={choreo.pin} label={result?.name ?? null} /> : null}

      {geo ? (
        <HomeActions
          top={geo.actionsTop}
          phase={phase}
          mode={mode}
          regionsPending={regions.isPending}
          regionsError={regions.isError ? regions.error : null}
          onRetry={() => regions.refetch()}
          onRandom={drawRandom}
          onManual={openPicker}
        />
      ) : null}

      <DestinationSheet
        sheetRef={sheetRef}
        animatedIndex={sheetIndex}
        initialIndex={restored ? 0 : -1}
        region={result}
        maxExpanded={geo?.maxExpanded ?? SHEET.compact + SHEET.minExpandedExtra}
        onExpandedHeightChange={setExpandedHeight}
        onRedraw={redraw}
        onCreateTrip={createTrip}
      />

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
  // 탭바 위 영역. 닫힌 시트가 탭바 쪽으로 비어져 나오지 않게 잘라 냅니다.
  root: { flex: 1, backgroundColor: colors.white, overflow: "hidden" },
});
