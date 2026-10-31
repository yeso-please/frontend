import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { regionApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import { Icons } from "@/components/icons";
import { AppText, Button, Tag } from "@/components/ui";
import { secureImageUrl } from "@/lib/imageUrl";
import { colors, radius, screenPadding, shadows, space } from "@/theme";

import { SHEET } from "../lib/geometry";
import type { DiscoveredRegion } from "../lib/regions";
import { ShimmerBlock } from "./Shimmer";

export const CARD_STALE_TIME = 10 * 60_000;

type Props = {
  /** 0 = 내려감, 1 = 올라옴 */
  progress: SharedValue<number>;
  /** 보여 줄 결과 지역 (다시 뽑는 동안에는 이전 결과 유지) */
  region: DiscoveredRegion | null;
  /** "낭만적인 기록가에게 어울리는 느긋한 여행" — 설문 MBTI가 없으면 null */
  personaLine: string | null;
  onRedraw: () => void;
  onExplore: () => void;
};

const hashTag = (tag: string) => (tag.startsWith("#") ? tag : `#${tag}`);
/** 지역 대표 사진 썸네일 (요청서 #5) */
const PHOTO = 80;

/** "강릉 알아보기"가 버튼에 다 들어가지 않으면(긴 구 이름·좁은 화면) 짧은 문구로 바꿉니다. */
const REDRAW_WIDTH = 92;
const BUTTON_EXTRA = 21 + 8 + 16 * 2; // 핀 아이콘 + 간격 + 좌우 여백
const estimateLabelWidth = (text: string) => [...text].reduce((sum, ch) => sum + (/[가-힣]/.test(ch) ? 16 : ch === " " ? 4.5 : 9.5), 0);
const exploreLabel = (name: string, available: number) => {
  const full = `${name} 알아보기`;
  return estimateLabelWidth(full) + BUTTON_EXTRA <= available ? full : "자세히 알아보기";
};

/** 피그마 B3 Destination sheet (0,478 · 390×288): 이번 여행지는 / 지역 / 한 줄 소개 / #태그 / 다시 뽑기 · 알아보기 / 성향 한 줄 */
export function DestinationSheet({ progress, region, personaLine, onRedraw, onExplore }: Props) {
  const { width } = useWindowDimensions();
  const card = useQuery({
    queryKey: queryKeys.regionCard(region?.sigCd ?? ""),
    queryFn: () => regionApi.card(region?.sigCd ?? ""),
    enabled: !!region,
    staleTime: CARD_STALE_TIME,
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [SHEET.height + 24, 0], Extrapolation.CLAMP) }],
  }));
  // 내려간 동안에는 그림자가 탭바 위로 비치지 않게 숨깁니다.
  const shadowStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 0.2], [0, 1], Extrapolation.CLAMP) }));

  if (!region) return null;
  const data = card.data;
  const tagline = data?.tagline?.trim() || null;
  const tags = (data?.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 4);
  // 대표 사진: 받는 중에는 자리만 잡아 카드 높이가 흔들리지 않게, 사진이 없는 지역은 자리를 없앱니다.
  const photo = secureImageUrl(data?.heroImage?.url);
  const credit = data?.heroImage?.sourceName ?? null;

  return (
    <Animated.View style={[styles.sheet, sheetStyle]} pointerEvents="box-none" accessibilityViewIsModal={false}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.background, shadowStyle]} pointerEvents="none" />
      <View style={styles.handleArea}>
        <View style={styles.handle} />
      </View>
      <View style={styles.body}>
        <View style={styles.bodyText}>
          <AppText variant="caption" color="darkgreen">
            이번 여행지는
          </AppText>
          <AppText variant="title" numberOfLines={1} accessibilityRole="header">
            {region.name}
          </AppText>

          {card.isPending ? (
            <View style={styles.summary} accessibilityLabel="지역 소개를 불러오는 중이에요">
              <ShimmerBlock width={220} height={16} />
              <View style={styles.tags}>
                <ShimmerBlock width={56} height={28} radius={radius.md} />
                <ShimmerBlock width={56} height={28} radius={radius.md} />
                <ShimmerBlock width={68} height={28} radius={radius.md} />
              </View>
            </View>
          ) : card.isError ? (
            <View style={styles.summary}>
              <AppText variant="body" color="muted" numberOfLines={1}>
                {region.province} {region.city}
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
              {/* 소개가 승인 전이면 비어 있습니다 — 지어내지 않고 지역 이름을 보여 줍니다 */}
              <AppText variant="body" color="muted" numberOfLines={2}>
                {tagline ?? `${region.province} ${region.city}`}
              </AppText>
              {tags.length > 0 ? (
                <View style={styles.tags}>
                  {tags.map((tag) => (
                    <Tag key={tag} label={hashTag(tag)} />
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </View>
        {card.isPending ? (
          <View style={styles.photoBox}>
            <ShimmerBlock width={PHOTO} height={PHOTO} radius={radius.md} />
          </View>
        ) : photo ? (
          <View style={styles.photoBox}>
            <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" transition={200} accessibilityLabel={`${region.name} 대표 사진`} />
            {credit ? (
              <AppText variant="badge" color="muted" numberOfLines={1} style={styles.credit}>
                {`사진 ${credit}`}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.actions}>
          <Button
            label="다시 뽑기"
            variant="neutral"
            labelColor="darkgreen"
            height={46}
            onPress={onRedraw}
            style={styles.redraw}
            accessibilityHint="다른 지역으로 핀을 다시 꽂아요"
          />
          <Button
            label={exploreLabel(region.name, width - screenPadding * 2 - REDRAW_WIDTH - space[8])}
            variant="primary"
            height={46}
            leftIcon={<Icons.PinButton width={21} height={21} />}
            onPress={onExplore}
            style={styles.flex}
            accessibilityHint={`${region.name}의 대표 사진과 만나볼 순간을 봐요`}
          />
        </View>
        {personaLine ? (
          <AppText variant="caption" color="blue" numberOfLines={1}>
            {personaLine}
          </AppText>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, height: SHEET.height },
  background: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadows.sheet,
  },
  handleArea: { height: 24, paddingTop: space[8], alignItems: "center", justifyContent: "center" },
  handle: { width: 36, height: 4, borderRadius: radius.xs, backgroundColor: colors.border },
  // 왼쪽 글(이름·소개·태그), 오른쪽 대표 사진 — 카드 높이는 그대로입니다.
  body: { flexDirection: "row", alignItems: "flex-start", gap: space[12], paddingTop: space[4], paddingHorizontal: screenPadding },
  bodyText: { flex: 1, gap: 2 },
  photoBox: { width: PHOTO, gap: 2, marginTop: space[8] },
  photo: { width: PHOTO, height: PHOTO, borderRadius: radius.md, backgroundColor: colors.surface },
  credit: { fontSize: 9, lineHeight: 12 },
  summary: { gap: space[8], marginTop: 2 },
  tags: { flexDirection: "row", gap: space[8], height: 28, overflow: "hidden" },
  noteRow: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: space[8] },
  footer: { position: "absolute", left: screenPadding, right: screenPadding, bottom: space[16], gap: space[12] },
  actions: { flexDirection: "row", gap: space[8] },
  redraw: { width: REDRAW_WIDTH, paddingHorizontal: 10 },
});
