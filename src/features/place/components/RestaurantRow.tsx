import { Linking, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";

import type { RestaurantCandidate } from "@/api/types";
import { AppText, PressableScale } from "@/components/ui";
import { formatDistance } from "@/features/course/format";
import { kakaoMapLink } from "@/features/kakaoMap/links";
import { colors, motion, radius, space } from "@/theme";

import { restaurantCategoryLabel } from "../lib";
import { PlaceThumb } from "./PlaceThumb";

type Props = {
  item: RestaurantCandidate;
  number: number;
  selected: boolean;
  onPress: () => void;
  onLayoutY?: (y: number) => void;
};

/** 식당 후보 행 — 원천이 준 정보(분류·거리·주소·추천 이유·근거·대표 메뉴)만 보여 주고 맛·평점 문구는 만들지 않습니다 */
export function RestaurantRow({ item, number, selected, onPress, onLayoutY }: Props) {
  const meta = [restaurantCategoryLabel(item.category), formatDistance(item.distanceMeters)].filter(Boolean).join(" · ");
  const address = item.roadAddress ?? item.address;
  const mapUrl = item.placeUrl ?? kakaoMapLink(item.name, item.lat, item.lng);
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(number - 1, 8) * 40).springify().damping(motion.spring.gentle.damping)}
      layout={LinearTransition.springify().damping(motion.spring.gentle.damping)}
      onLayout={(e) => onLayoutY?.(e.nativeEvent.layout.y)}
    >
      <PressableScale
        onPress={onPress}
        haptic="tick"
        scaleTo={0.98}
        style={[styles.card, selected && styles.selected]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${number}번 식당 ${item.name}, ${meta}`}
      >
        <View style={styles.top}>
          <PlaceThumb url={item.imageUrl} label={item.name} size={{ width: 64, height: 56 }} />
          <View style={styles.texts}>
            <AppText variant="bold14" numberOfLines={2}>{`${number}. ${item.name}`}</AppText>
            <AppText variant="small12" color="muted" numberOfLines={1}>
              {meta}
            </AppText>
            {address ? (
              <AppText variant="small12" color="muted" numberOfLines={1}>
                {address}
              </AppText>
            ) : null}
          </View>
        </View>
        {/* 추천 이유(5-5, 최대 2개) — 서버가 동선·종류로 만든 문장 그대로 */}
        {item.reasons && item.reasons.length > 0 ? (
          <View style={styles.reasons}>
            {item.reasons.slice(0, 2).map((reason) => (
              <AppText key={reason} variant="small12" color="muted">
                {`· ${reason}`}
              </AppText>
            ))}
          </View>
        ) : null}
        {item.representativeMenu ? <AppText variant="small13">{`대표 메뉴 · ${item.representativeMenu}`}</AppText> : null}
        <View style={styles.footer}>
          <View style={styles.labels}>
            {item.evidenceLabels.slice(0, 2).map((label) => (
              <View key={label} style={styles.evidence}>
                <AppText variant="badge" color="darkgreen">
                  {label}
                </AppText>
              </View>
            ))}
          </View>
          <PressableScale
            onPress={() => Linking.openURL(mapUrl).catch(() => undefined)}
            haptic="tap"
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel={`${item.name} 카카오맵에서 보기`}
          >
            <AppText variant="small12" color="blue">
              카카오맵에서 보기
            </AppText>
          </PressableScale>
        </View>
        {selected ? (
          <Animated.View entering={FadeIn.duration(180)}>
            <AppText variant="small13Bold" color="darkgreen">
              ✓ 이 식당으로 정할 예정이에요
            </AppText>
          </Animated.View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  reasons: { gap: 2 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space[16], gap: space[8], backgroundColor: colors.white },
  selected: { borderColor: colors.blue, borderWidth: 1.5, backgroundColor: colors.paleblue },
  top: { flexDirection: "row", gap: space[12], alignItems: "center" },
  texts: { flex: 1, gap: 2 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[8] },
  labels: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  evidence: { paddingHorizontal: space[8], paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.mint },
});
