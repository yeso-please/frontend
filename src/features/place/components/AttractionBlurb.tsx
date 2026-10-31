import { StyleSheet, View } from "react-native";

import { AppText, PressableScale } from "@/components/ui";
import { ShimmerBlock } from "@/features/discover/components/Shimmer";
import { space } from "@/theme";

import { useAttractionDetail } from "./AttractionDetailSheet";

/**
 * 장소 편집에서 바로 보는 관광지 소개 (7-4): 한 줄 소개 → 원천 설명 앞 3줄 → "더보기"(상세 시트).
 * 시트와 같은 캐시를 써서 시트를 열 때 다시 부르지 않습니다. 둘 다 없거나 불러오지 못하면 숨깁니다.
 */
export function AttractionBlurb({ attractionId, onMore }: { attractionId: number; onMore: () => void }) {
  const detail = useAttractionDetail(attractionId);

  if (detail.isPending) {
    return (
      <View style={styles.wrap} accessibilityLabel="장소 소개를 불러오는 중이에요">
        <ShimmerBlock width={220} height={13} />
        <ShimmerBlock width={260} height={13} />
      </View>
    );
  }
  if (detail.isError) return null;
  const { oneLine, description } = detail.data;
  if (!oneLine && !description) return null;

  return (
    <View style={styles.wrap}>
      {oneLine ? (
        <AppText variant="small13Medium" color="darkgreen">
          {oneLine}
        </AppText>
      ) : null}
      {description ? (
        <AppText variant="small13" color="charcoal" numberOfLines={3}>
          {description}
        </AppText>
      ) : null}
      {description ? (
        <PressableScale onPress={onMore} haptic="tick" hitSlop={8} style={styles.more} accessibilityRole="button" accessibilityLabel="장소 설명 더보기">
          <AppText variant="small12" color="muted">
            더보기
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  more: { alignSelf: "flex-start" },
});
