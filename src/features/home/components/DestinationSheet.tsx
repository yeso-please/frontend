import BottomSheet, {
  type BottomSheetBackgroundProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetScrollView,
  useBottomSheetSpringConfigs,
} from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { type RefObject, useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { regionApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { RegionCard } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, Button, PressableScale, Tag } from "@/components/ui";
import { withEuro } from "@/lib/josa";
import { colors, motion, radius, screenPadding, shadows, sizes, space } from "@/theme";

import { SHEET } from "../lib/geometry";
import type { MapRegion } from "../lib/regions";
import { ShimmerBlock } from "./Shimmer";

export const CARD_STALE_TIME = 10 * 60_000;

type Props = {
  sheetRef: RefObject<BottomSheet | null>;
  /** 시트 위치(-1 닫힘 · 0 접힘 · 1 펼침). 지도가 이 값을 따라 움직입니다. */
  animatedIndex: SharedValue<number>;
  initialIndex: number;
  /** 보여 줄 결과 지역 (다시 뽑는 동안에는 이전 결과 유지) */
  region: MapRegion | null;
  maxExpanded: number;
  onExpandedHeightChange: (height: number) => void;
  onRedraw: () => void;
  onCreateTrip: () => void;
};

/** 피그마 Destination sheet — State=Compact(h288) ⇄ State=Expanded(내용 높이, 피그마 h444) */
export function DestinationSheet({ sheetRef, animatedIndex, initialIndex, region, maxExpanded, onExpandedHeightChange, onRedraw, onCreateTrip }: Props) {
  const [bodyHeight, setBodyHeight] = useState(0);
  const [expanded, setExpanded] = useState(initialIndex === 1);
  const animationConfigs = useBottomSheetSpringConfigs(motion.spring.gentle);

  // 펼친 높이는 내용에 맞춥니다. 소개가 없는 지역은 빈 공간 없이 짧게, 내용이 많으면 화면 위쪽 한도까지.
  const expandedHeight = Math.round(Math.min(maxExpanded, Math.max(SHEET.compact + SHEET.minExpandedExtra, SHEET.handle + bodyHeight + SHEET.footer)));
  const snapPoints = useMemo(() => [SHEET.compact, expandedHeight], [expandedHeight]);
  useEffect(() => onExpandedHeightChange(expandedHeight), [expandedHeight, onExpandedHeightChange]);

  const expand = useCallback(() => sheetRef.current?.snapToIndex(1), [sheetRef]);
  const collapse = useCallback(() => sheetRef.current?.snapToIndex(0), [sheetRef]);

  // 펼친 상태에서 Android 뒤로가기는 시트를 접습니다.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!expanded) return false;
        sheetRef.current?.snapToIndex(0);
        return true;
      });
      return () => sub.remove();
    }, [expanded, sheetRef]),
  );

  const name = region?.name ?? "";
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <SheetFooter {...props} animatedIndex={animatedIndex} name={name} expanded={expanded} onExpand={expand} onRedraw={onRedraw} onCreateTrip={onCreateTrip} />
    ),
    [animatedIndex, name, expanded, expand, onRedraw, onCreateTrip],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={initialIndex}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      animatedIndex={animatedIndex}
      animationConfigs={animationConfigs}
      handleComponent={SheetHandle}
      backgroundComponent={SheetBackground}
      footerComponent={region ? renderFooter : undefined}
      onAnimate={(_from, to) => setExpanded(to === 1)}
      onChange={(index) => setExpanded(index === 1)}
    >
      <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {region ? (
          <View onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)} style={styles.body}>
            <SheetBody region={region} animatedIndex={animatedIndex} expanded={expanded} onExpand={expand} onCollapse={collapse} />
          </View>
        ) : (
          <View />
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

type CardView = { description: string | null; tags: string[]; landmarks: string[] };

// 소개 콘텐츠가 없는 지역은 title = 도시명, 배열은 모두 빈 값으로 옵니다. 지어내지 않고 있는 것만 보여 줍니다.
function toCardView(region: MapRegion, card: RegionCard): CardView {
  const title = card.title.trim();
  const isPlaceName = !title || title === card.city || title === region.name || title === `${card.province} ${card.city}`;
  const intro = card.introduction.map((p) => p.trim()).find(Boolean) ?? null;
  return {
    description: isPlaceName ? intro : title,
    tags: card.characteristics.map((t) => t.trim()).filter(Boolean).slice(0, 3),
    landmarks: card.landmarks.map((l) => l.name.trim()).filter(Boolean).slice(0, 3),
  };
}

const hashTag = (tag: string) => (tag.startsWith("#") ? tag : `#${tag}`);

function SheetBody({
  region,
  animatedIndex,
  expanded,
  onExpand,
  onCollapse,
}: {
  region: MapRegion;
  animatedIndex: SharedValue<number>;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const card = useQuery({
    queryKey: queryKeys.regionCard(region.sigCd),
    queryFn: () => regionApi.card(region.sigCd),
    staleTime: CARD_STALE_TIME,
  });
  const view = card.data ? toCardView(region, card.data) : null;
  const placeLine = `${region.province} ${region.city}`;

  // 펼칠수록 아래 영역(이런 순간·AI 힌트)이 떠오르며 나타납니다.
  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0.2, 0.9], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(animatedIndex.value, [0, 1], [12, 0], Extrapolation.CLAMP) }],
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0, 0.6], [1, 0], Extrapolation.CLAMP),
    transform: [{ rotate: `${interpolate(animatedIndex.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` }],
  }));
  const closeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ rotate: `${interpolate(animatedIndex.value, [0, 1], [-90, 0], Extrapolation.CLAMP)}deg` }],
  }));

  return (
    <>
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="caption" color="darkgreen">
            이번 여행지는
          </AppText>
          <AppText variant="title" numberOfLines={1} accessibilityRole="header">
            {region.name}
          </AppText>
        </View>
        <View style={styles.headerButton}>
          <Animated.View
            style={[StyleSheet.absoluteFill, chevronStyle]}
            pointerEvents={expanded ? "none" : "auto"}
            importantForAccessibility={expanded ? "no-hide-descendants" : "auto"}
          >
            <PressableScale onPress={onExpand} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`${region.name} 자세히 보기`}>
              <Icons.ChevronUp width={22} height={22} />
            </PressableScale>
          </Animated.View>
          <Animated.View
            style={[StyleSheet.absoluteFill, closeStyle]}
            pointerEvents={expanded ? "auto" : "none"}
            importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
          >
            <PressableScale onPress={onCollapse} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="간단히 보기">
              <Icons.Close width={22} height={22} />
            </PressableScale>
          </Animated.View>
        </View>
      </View>

      {card.isPending ? (
        <View style={styles.summary} accessibilityLabel="지역 소개를 불러오는 중이에요">
          <ShimmerBlock width={232} height={16} />
          <View style={styles.tags}>
            <ShimmerBlock width={56} height={28} radius={radius.md} />
            <ShimmerBlock width={56} height={28} radius={radius.md} />
            <ShimmerBlock width={76} height={28} radius={radius.md} />
          </View>
        </View>
      ) : card.isError ? (
        <View style={styles.summary}>
          <AppText variant="body" color="muted" numberOfLines={1}>
            {placeLine}
          </AppText>
          <View style={styles.noteRow}>
            <AppText variant="caption" color="muted">
              소개를 불러오지 못했어요
            </AppText>
            <Pressable onPress={() => card.refetch()} hitSlop={12} accessibilityRole="button" accessibilityLabel="지역 소개 다시 불러오기">
              <AppText variant="caption" color="blue">
                다시 불러오기
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.summary}>
          <AppText variant="body" color="muted" numberOfLines={2}>
            {view?.description ?? placeLine}
          </AppText>
          {view && view.tags.length > 0 ? (
            <View style={styles.tags}>
              {view.tags.map((tag) => (
                <Tag key={tag} label={hashTag(tag)} />
              ))}
            </View>
          ) : view && !view.description && view.landmarks.length === 0 ? (
            <View style={styles.noteRow}>
              <AppText variant="caption" color="muted">
                아직 소개가 준비 중인 지역이에요
              </AppText>
            </View>
          ) : null}
        </View>
      )}

      <Animated.View
        style={[styles.details, revealStyle]}
        pointerEvents={expanded ? "auto" : "none"}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
      >
        {view && view.landmarks.length > 0 ? (
          <View style={styles.moments}>
            <View style={styles.divider} />
            <AppText variant="label">이런 순간을 만나보세요</AppText>
            {view.landmarks.map((landmark, i) => (
              <View key={`${landmark}-${i}`} style={styles.momentRow}>
                {i % 2 === 0 ? <Icons.PinBlue20 width={20} height={20} /> : <Icons.PinDarkgreen20 width={20} height={20} />}
                <AppText variant="body" numberOfLines={1} style={styles.flex}>
                  {landmark}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        {/* 피그마 TriPin/AI hint (paleblue, r12, spark 20) */}
        <View style={styles.aiHint}>
          <Icons.Spark width={20} height={20} />
          <View style={styles.flex}>
            <AppText variant="caption" color="blue">
              다음은, 나에게 맞는 여행
            </AppText>
            <AppText variant="caption">취향을 고르면 AI가 코스를 만들어줘요.</AppText>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

/** "강릉으로 여행 만들기"가 버튼에 다 들어가지 않으면(긴 구 이름·좁은 화면) 짧은 문구로 바꿉니다. */
const CREATE_BUTTON_EXTRA = 21 + 8 + 12 * 2; // 핀 아이콘 + 간격 + 좌우 여백
const REDRAW_WIDTH = 88;
const estimateLabelWidth = (text: string) => [...text].reduce((sum, ch) => sum + (/[가-힣]/.test(ch) ? 16 : ch === " " ? 4.5 : 9.5), 0);

function createTripLabel(name: string, available: number) {
  const full = `${withEuro(name)} 여행 만들기`;
  if (estimateLabelWidth(full) + CREATE_BUTTON_EXTRA <= available) return full;
  return "이곳으로 여행 만들기";
}

function SheetFooter({
  animatedFooterPosition,
  animatedIndex,
  name,
  expanded,
  onExpand,
  onRedraw,
  onCreateTrip,
}: BottomSheetFooterProps & {
  animatedIndex: SharedValue<number>;
  name: string;
  expanded: boolean;
  onExpand: () => void;
  onRedraw: () => void;
  onCreateTrip: () => void;
}) {
  const { width } = useWindowDimensions();
  const createLabel = createTripLabel(name, width - screenPadding * 2 - REDRAW_WIDTH - space[8]);
  // 접힘: 파란 "위로 올려 … 더 알아보기" / 펼침: 회색 안내 문구 (피그마 03·04)
  const linkStyle = useAnimatedStyle(() => ({ opacity: interpolate(animatedIndex.value, [0, 0.5], [1, 0], Extrapolation.CLAMP) }));
  const noteStyle = useAnimatedStyle(() => ({ opacity: interpolate(animatedIndex.value, [0.5, 1], [0, 1], Extrapolation.CLAMP) }));

  return (
    <BottomSheetFooter animatedFooterPosition={animatedFooterPosition}>
      <View style={styles.footer}>
        <View style={styles.actions}>
          <Button label="다시 뽑기" variant="neutral" labelColor="darkgreen" height={46} onPress={onRedraw} style={styles.redraw} accessibilityHint="다른 지역으로 핀을 다시 꽂아요" />
          <Button
            label={createLabel}
            variant="primary"
            height={46}
            leftIcon={<Icons.PinButton width={21} height={21} />}
            onPress={onCreateTrip}
            style={styles.create}
            accessibilityHint={`${name} 여행 준비를 시작해요`}
          />
        </View>
        <View style={styles.captionSlot}>
          <Animated.View style={[styles.caption, linkStyle]} pointerEvents={expanded ? "none" : "auto"}>
            <Pressable onPress={onExpand} hitSlop={13} accessibilityRole="button" disabled={expanded}>
              <AppText variant="caption" color="blue">
                위로 올려 {name} 더 알아보기
              </AppText>
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.caption, noteStyle]} pointerEvents="none" importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}>
            <AppText variant="caption" color="muted">
              취향 선택 후 AI 여행 코스를 만들어요
            </AppText>
          </Animated.View>
        </View>
      </View>
    </BottomSheetFooter>
  );
}

/** 피그마 Drag handle: 위 여백 8 + 높이 16 영역 가운데 36×4 (border색, r2) */
export function SheetHandle() {
  return (
    <View style={styles.handleArea}>
      <View style={styles.handle} />
    </View>
  );
}

/** 흰 배경 + 위 모서리 24 + TriPin/Sheet 그림자. 완전히 내려가 있을 때는 그림자가 탭바 위로 비치지 않게 숨깁니다. */
function SheetBackground({ style, animatedIndex }: BottomSheetBackgroundProps) {
  const fade = useAnimatedStyle(() => ({ opacity: interpolate(animatedIndex.value, [-1, -0.9], [0, 1], Extrapolation.CLAMP) }));
  return <Animated.View pointerEvents="none" style={[style, styles.background, fade]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: SHEET.footer },
  body: { paddingTop: space[8], paddingHorizontal: screenPadding, gap: space[8] },
  header: { height: 52, flexDirection: "row", alignItems: "center", gap: space[8] },
  headerButton: { width: sizes.touchTarget, height: sizes.touchTarget },
  iconButton: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: "center", justifyContent: "center" },
  summary: { gap: space[8] },
  tags: { flexDirection: "row", gap: space[8], height: 28, overflow: "hidden" },
  noteRow: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: space[8] },
  details: { gap: space[8], paddingTop: 1 },
  moments: { gap: space[12] },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border, marginTop: space[4] },
  momentRow: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: space[8] },
  aiHint: {
    minHeight: 50,
    marginTop: space[4],
    paddingHorizontal: space[12],
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.paleblue,
    flexDirection: "row",
    alignItems: "center",
    gap: space[8],
  },
  footer: {
    height: SHEET.footer,
    paddingTop: space[8],
    paddingHorizontal: screenPadding,
    backgroundColor: colors.white,
    gap: space[8],
  },
  actions: { flexDirection: "row", gap: space[8] },
  redraw: { minWidth: REDRAW_WIDTH, paddingHorizontal: 10 },
  create: { flex: 1, paddingHorizontal: space[12] },
  captionSlot: { height: 18 },
  caption: { position: "absolute", left: 0, top: 0 },
  handleArea: { height: SHEET.handle, paddingTop: space[8], alignItems: "center", justifyContent: "center" },
  handle: { width: 36, height: 4, borderRadius: radius.xs, backgroundColor: colors.border },
  background: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadows.sheet,
  },
});
