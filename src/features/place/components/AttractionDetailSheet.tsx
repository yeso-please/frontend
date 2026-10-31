import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import type { RefObject } from "react";
import { useState } from "react";
import { ActivityIndicator, FlatList, Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { attractionApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { AttractionDetail } from "@/api/types";
import { AppText, Button, PressableScale } from "@/components/ui";
import { CATEGORY_LABEL } from "@/features/course/components/CategoryGlyph";
import { kakaoMapLink } from "@/features/kakaoMap";
import { secureImageUrl } from "@/lib/imageUrl";
import { useSheetBackHandler } from "@/lib/useSheetBackHandler";
import { colors, radius, screenPadding, shadows, space } from "@/theme";

const renderBackdrop = (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />;
const DESCRIPTION_LINES = 6;

const NOT_RECOMMENDABLE: Record<AttractionDetail["notRecommendableReasons"][number], string> = {
  MISSING_DESCRIPTION: "설명이 없어요",
  MISSING_IMAGE: "사진이 없어요",
  MISSING_COORDINATE: "위치 정보가 없어요",
  QUALITY_ISSUE: "정보를 확인하고 있어요",
};

type Props = { sheetRef: RefObject<BottomSheetModal | null>; attractionId: number | null };

/** 관광지 상세 7-4 (회원 전용). 시트·코스 카드·장소 편집 요약이 같은 캐시를 씁니다. */
export function useAttractionDetail(attractionId: number) {
  return useQuery({ queryKey: queryKeys.attraction(attractionId), queryFn: () => attractionApi.detail(attractionId), staleTime: 10 * 60_000 });
}

/**
 * 관광지 상세 (7-4) — 코스 카드의 "상세보기", 장소 편집·추가에서 엽니다. 공유·비회원 화면에서는 열지 않습니다(회원 전용 API).
 * 설명은 원천(한국관광공사) 글 그대로이고, 한 줄 소개는 사람이 승인한 것만 옵니다.
 */
export function AttractionDetailSheet({ sheetRef, attractionId }: Props) {
  const insets = useSafeAreaInsets();
  const back = useSheetBackHandler(sheetRef);
  return (
    <BottomSheetModal ref={sheetRef} onChange={back.onChange} snapPoints={["80%"]} enableDynamicSizing={false} backdropComponent={renderBackdrop} handleIndicatorStyle={styles.handle} backgroundStyle={styles.sheet}>
      <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[24] }]}>
        {attractionId != null ? <DetailContent attractionId={attractionId} /> : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

function DetailContent({ attractionId }: { attractionId: number }) {
  const detail = useAttractionDetail(attractionId);
  const [expanded, setExpanded] = useState(false);

  if (detail.isPending) return <ActivityIndicator color={colors.green} style={styles.loading} />;
  if (detail.isError) {
    return (
      <AppText variant="small13" color="muted">
        {/* 없는 관광지·음식점·숙박 등은 404 */}
        {isApiError(detail.error, "ATTRACTION_NOT_FOUND") ? "정보를 불러오지 못했어요" : errorMessage(detail.error)}
      </AppText>
    );
  }

  const a = detail.data;
  const minutes = a.estimatedDurationMinutes;
  const stay = `머무는 시간 ${minutes >= 60 ? `약 ${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}` : `약 ${minutes}분`}${a.estimated ? " (참고값)" : ""}`;
  const info: [string, string | null][] = [
    ["주소", a.address],
    ["이용 시간", a.useTime],
    ["쉬는 날", a.restDate],
  ];

  return (
    <View style={styles.body}>
      <Photos images={a.images} name={a.name} />

      <View style={styles.titleBlock}>
        <AppText variant="cardTitle" accessibilityRole="header">
          {a.name}
        </AppText>
        <AppText variant="small13" color="muted">
          {[CATEGORY_LABEL[a.category], stay].join(" · ")}
        </AppText>
        {a.oneLine ? (
          <AppText variant="body" color="darkgreen" style={styles.oneLine}>
            {a.oneLine}
          </AppText>
        ) : null}
        {a.oneLine && a.summaryBasis === "NAME_CATEGORY" ? (
          <AppText variant="badge" color="muted">
            AI가 이름·분류로 만든 소개예요
          </AppText>
        ) : null}
        {a.tags.length > 0 ? (
          <View style={styles.tags}>
            {a.tags.map((t) => (
              <View key={t} style={styles.tag}>
                <AppText variant="caption" color="darkgreen">{`#${t}`}</AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {!a.recommendable ? (
        <View style={styles.notice} accessibilityRole="alert">
          <AppText variant="small13Bold" color="charcoal">
            지금은 코스에 넣을 수 없는 장소예요
          </AppText>
          {a.notRecommendableReasons.length > 0 ? (
            <AppText variant="small12" color="muted">
              {a.notRecommendableReasons.map((r) => NOT_RECOMMENDABLE[r]).join(" · ")}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View style={styles.info}>
        {info
          .filter(([, v]) => !!v)
          .map(([label, value]) => (
            <View key={label} style={styles.infoRow}>
              <AppText variant="small13Bold" style={styles.infoLabel}>
                {label}
              </AppText>
              <AppText variant="small13" style={styles.flex}>
                {value}
              </AppText>
            </View>
          ))}
      </View>

      {a.description ? (
        <View style={styles.description}>
          <AppText variant="body" numberOfLines={expanded ? undefined : DESCRIPTION_LINES}>
            {a.description}
          </AppText>
          <PressableScale onPress={() => setExpanded((v) => !v)} haptic={false} hitSlop={6} accessibilityRole="button">
            <AppText variant="small12" color="muted">
              {expanded ? "접기" : "더 보기"}
            </AppText>
          </PressableScale>
        </View>
      ) : null}

      <Button label="카카오맵에서 보기" variant="outline" height={44} onPress={() => void Linking.openURL(kakaoMapLink(a.name, a.lat, a.lng))} />
      {a.sources.length > 0 ? (
        <AppText variant="badge" color="muted">
          {`출처: ${a.sources.map((s) => s.name).join(", ")}`}
        </AppText>
      ) : null}
    </View>
  );
}

/** 사진 여러 장을 옆으로 넘겨 봅니다. 사진마다 출처(공공누리 등)를 작게 붙입니다. */
function Photos({ images, name }: { images: AttractionDetail["images"]; name: string }) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const shown = images.filter((img) => !!secureImageUrl(img.url));
  if (shown.length === 0) return null;
  const credit = (img: AttractionDetail["images"][number]) => [img.sourceName, img.license].filter(Boolean).join(" · ");
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          data={shown}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(img, i) => `${img.url}-${i}`}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index }) => (
            <View style={{ width }}>
              <Image
                source={{ uri: secureImageUrl(item.url) ?? undefined }}
                style={styles.image}
                contentFit="cover"
                transition={200}
                accessibilityLabel={`${name} 사진 ${index + 1}/${shown.length}`}
              />
            </View>
          )}
        />
      ) : (
        <View style={styles.image} />
      )}
      <View style={styles.captionRow}>
        <AppText variant="badge" color="muted" style={styles.flex} numberOfLines={1}>
          {credit(shown[Math.min(page, shown.length - 1)]) ? `사진: ${credit(shown[Math.min(page, shown.length - 1)])}` : ""}
        </AppText>
        {shown.length > 1 ? (
          <AppText variant="badge" color="muted">
            {`${Math.min(page, shown.length - 1) + 1} / ${shown.length}`}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  handle: { width: 38, height: 4, backgroundColor: "#D7DDD9" },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadows.sheet },
  content: { paddingHorizontal: screenPadding, paddingTop: space[8] },
  loading: { marginVertical: space[32] },
  body: { gap: space[16] },
  image: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.lg, backgroundColor: colors.surface },
  captionRow: { flexDirection: "row", gap: space[8], marginTop: space[4] },
  titleBlock: { gap: space[4] },
  oneLine: { marginTop: space[4] },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space[4], marginTop: space[4] },
  tag: { paddingHorizontal: space[8], paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.mint },
  notice: { gap: 2, padding: space[12], borderRadius: radius.md, backgroundColor: colors.surface },
  info: { gap: space[8] },
  infoRow: { flexDirection: "row", gap: space[12] },
  infoLabel: { width: 64 },
  description: { gap: space[4] },
});
