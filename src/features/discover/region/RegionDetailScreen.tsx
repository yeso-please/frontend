import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Share, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { regionApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { RegionSelection } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, Button, ErrorView, PressableScale, Screen } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { shortRegionName, withEuro } from "@/lib/josa";
import { useTripDraft } from "@/store/tripDraft";
import { colors, motion, radius, screenPadding, sizes, space } from "@/theme";

import { ShimmerBlock } from "../components/Shimmer";
import { useDiscoverDraw } from "../store";
import { GenerationModeToggle } from "./GenerationModeToggle";
import { LandmarkCards } from "./LandmarkCards";
import { MatchBox } from "./MatchBox";
import { RegionHero } from "./RegionHero";

const ORIGIN_LABEL: Record<RegionSelection, string> = {
  RANDOM: "랜덤 핀이 도착한 곳",
  CONDITIONAL: "내 취향으로 찾은 곳",
  MANUAL: "직접 고른 곳",
};

const isSelection = (value: string | undefined): value is RegionSelection => value === "RANDOM" || value === "CONDITIONAL" || value === "MANUAL";
const hashTag = (tag: string) => (tag.startsWith("#") ? tag : `#${tag}`);
const enter = (i: number) => FadeInDown.delay(80 + motion.stagger * i).springify().damping(motion.spring.gentle.damping);

/** 여행 만들기에 넘길 지역 중심 좌표 — 방금 뽑은 결과가 있으면 그것, 없으면 지역 목록에서 찾습니다. */
function useRegionCenter(sigCd: string) {
  const drawn = useDiscoverDraw((s) => (s.result?.sigCd === sigCd ? s.result : null));
  const list = useQuery({
    queryKey: queryKeys.regions(),
    queryFn: () => regionApi.list(),
    enabled: !drawn,
    staleTime: 60 * 60_000,
  });
  if (drawn) return { lat: drawn.lat, lng: drawn.lng };
  const region = list.data?.regions.find((r) => r.sigCd === sigCd);
  return region ? { lat: region.centerLat, lng: region.centerLng } : null;
}

/**
 * 피그마 B4 · 여행 · 강릉 추천 — 대표 사진(출처), 한 줄 소개·태그, 성향 맞춤 문장(7-6), 만나볼 순간 3곳,
 * 코스 방식(취향 반영/완전 랜덤) → "{지역}으로 여행 만들기" (C7 날짜 선택). 저장(북마크)은 이번 범위에서 뺍니다(D14).
 */
export function RegionDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sigCd: string; selection?: string; maxNights?: string }>();
  const sigCd = params.sigCd;
  const selection: RegionSelection = isSelection(params.selection) ? params.selection : "MANUAL";
  const maxNights = params.maxNights ? Number(params.maxNights) : null;

  const card = useQuery({ queryKey: queryKeys.regionCard(sigCd), queryFn: () => regionApi.card(sigCd), staleTime: 10 * 60_000 });
  const center = useRegionCenter(sigCd);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const data = card.data;
  const name = data ? shortRegionName(data.province, data.city) : "";
  const tagline = data?.tagline?.trim() || null;
  const tags = (data?.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 4);
  const landmarks = data?.landmarks ?? [];

  const createTrip = () => {
    if (!data || !center) return;
    haptics.confirm();
    useTripDraft
      .getState()
      .setRegion({ sigCd, province: data.province, city: data.city, lat: center.lat, lng: center.lng }, selection, Number.isFinite(maxNights) ? maxNights : null);
    router.push("/trip/dates");
  };

  const redraw = () => {
    useDiscoverDraw.getState().requestRedraw();
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/travel");
  };

  const share = async () => {
    if (!data) return;
    try {
      await Share.share({ message: `TriPin에서 이번 여행지로 ${withEuro(name)} 핀을 꽂았어요.${tagline ? `\n${tagline}` : ""}` });
    } catch {
      // 공유 창을 닫았거나 지원하지 않는 기기 — 따로 알리지 않습니다.
    }
  };

  return (
    <Screen>
      {/* 피그마 Destination / Top App Bar: 뒤로 · "여행지 발견" · (저장 숨김) · 공유 */}
      <View style={styles.bar}>
        <PressableScale
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/travel"))}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={styles.iconButton}
          hitSlop={8}
        >
          <Icons.Back width={22} height={22} />
        </PressableScale>
        <AppText variant="label" numberOfLines={1} style={styles.barTitle}>
          여행지 발견
        </AppText>
        <PressableScale onPress={share} haptic="tick" accessibilityRole="button" accessibilityLabel={`${name} 공유하기`} style={styles.iconButton} disabled={!data}>
          <Icons.Share width={20} height={20} />
        </PressableScale>
      </View>

      {card.isError ? (
        <ErrorView error={card.error} onRetry={() => card.refetch()} />
      ) : (
        <>
          <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <RegionHero hero={data?.heroImage ?? null} name={name} scrollY={scrollY} />
            <View style={styles.content}>
              {!data ? (
                <View style={styles.skeleton} accessibilityLabel="지역 소개를 불러오는 중이에요">
                  <ShimmerBlock width={110} height={14} />
                  <ShimmerBlock width={190} height={36} />
                  <ShimmerBlock width={260} height={16} />
                  <ShimmerBlock width={220} height={16} />
                  <ShimmerBlock width={300} height={96} radius={radius.lg} />
                </View>
              ) : (
                <>
                  <Animated.View entering={enter(0)} style={styles.titleBlock}>
                    <AppText variant="caption" color="blue">
                      {ORIGIN_LABEL[selection]}
                    </AppText>
                    <AppText variant="headline" accessibilityRole="header">
                      <AppText variant="headline" color="green">
                        {name}
                      </AppText>{" "}
                      어때요?
                    </AppText>
                    {tagline ? (
                      <AppText variant="bodyMedium15" style={styles.tagline}>
                        {tagline}
                      </AppText>
                    ) : (
                      <AppText variant="body" color="muted">
                        {data.province} {data.city}
                      </AppText>
                    )}
                    {tags.length > 0 ? (
                      <View style={styles.tags}>
                        {tags.map((tag) => (
                          <View key={tag} style={styles.tag}>
                            <AppText variant="caption" color="blue">
                              {hashTag(tag)}
                            </AppText>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Animated.View>

                  <Animated.View entering={enter(1)}>
                    <MatchBox sigCd={sigCd} />
                  </Animated.View>

                  {landmarks.length > 0 ? (
                    <Animated.View entering={enter(2)} style={styles.section}>
                      <AppText variant="label" accessibilityRole="header">
                        {name}에서 만나볼 순간
                      </AppText>
                      <LandmarkCards landmarks={landmarks} />
                    </Animated.View>
                  ) : null}
                </>
              )}
            </View>
          </Animated.ScrollView>

          {/* 피그마 Generation Mode(24,857) + Bottom CTA(921): 여행 만들기 52 + 다시 뽑기 44 */}
          <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, space[8]) }]}>
            <GenerationModeToggle />
            <Button
              label={name ? `${withEuro(name)} 여행 만들기` : "여행 만들기"}
              variant="primary"
              rightIcon={<Icons.ArrowRight width={20} height={20} />}
              onPress={createTrip}
              disabled={!data || !center}
              accessibilityHint="여행 날짜를 고르러 가요"
            />
            <PressableScale onPress={redraw} haptic="tick" scaleTo={0.97} style={styles.redraw} accessibilityRole="button" accessibilityLabel="다시 뽑기">
              <AppText variant="small13Medium" color="muted">
                다시 뽑기
              </AppText>
            </PressableScale>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { height: sizes.appBar, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" },
  barTitle: { flex: 1, marginLeft: 0 },
  iconButton: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: space[24] },
  content: { paddingHorizontal: screenPadding, paddingTop: space[24], gap: space[24], backgroundColor: colors.white, minHeight: 300 },
  skeleton: { gap: space[12] },
  titleBlock: { gap: space[8] },
  tagline: { lineHeight: 23 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space[8], marginTop: space[4] },
  // 피그마 B4 태그: paleblue 배경 + blue 글자
  tag: { height: 28, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.paleblue, justifyContent: "center" },
  section: { gap: space[12] },
  bottom: { paddingHorizontal: screenPadding, paddingTop: space[12], gap: space[12], backgroundColor: colors.white },
  redraw: { height: sizes.touchTarget, marginTop: -space[8], alignItems: "center", justifyContent: "center" },
});

