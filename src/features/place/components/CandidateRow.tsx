import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";

import type { AlternativeItem } from "@/api/types";
import { AppText, PressableScale } from "@/components/ui";
import { formatMinutes } from "@/features/course/format";
import { colors, motion, radius, space } from "@/theme";

import { CATEGORY_LABEL } from "../lib";
import { PlaceThumb } from "./PlaceThumb";

type Props = {
  item: AlternativeItem;
  index: number;
  selected: boolean;
  onPress: () => void;
  onLayoutY?: (y: number) => void;
};

/** 피그마 F1 대체 추천 장소 행 — 썸네일, "n. 이름", 유형·머무는 시간, 추천 이유 */
export function CandidateRow({ item, index, selected, onPress, onLayoutY }: Props) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(motion.spring.gentle.damping)}
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
        accessibilityLabel={`${index + 1}번 후보 ${item.name}, ${CATEGORY_LABEL[item.category]}${item.reason ? `, ${item.reason}` : ""}`}
      >
        <View style={styles.top}>
          <PlaceThumb url={item.thumbnailUrl} label={item.name} />
          <View style={styles.texts}>
            <AppText variant="bold14" numberOfLines={2}>{`${index + 1}. ${item.name}`}</AppText>
            <AppText variant="small12" color="muted" numberOfLines={1}>
              {`${CATEGORY_LABEL[item.category]} · 머무는 시간 약 ${formatMinutes(item.estimatedDurationMinutes)}`}
            </AppText>
          </View>
        </View>
        {item.reason ? (
          <AppText variant="small13" color="charcoal">
            {item.reason}
          </AppText>
        ) : null}
        {selected ? (
          <Animated.View entering={FadeIn.duration(180)}>
            <AppText variant="small13Bold" color="darkgreen">
              ✓ 이 장소로 바꿀 예정이에요
            </AppText>
          </Animated.View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space[16], gap: space[12], backgroundColor: colors.white },
  selected: { borderColor: colors.blue, borderWidth: 1.5, backgroundColor: colors.paleblue },
  top: { flexDirection: "row", gap: space[12], alignItems: "center" },
  texts: { flex: 1, gap: 2 },
});
