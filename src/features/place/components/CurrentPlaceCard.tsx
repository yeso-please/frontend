import { StyleSheet, View } from "react-native";

import type { AttractionItem } from "@/api/types";
import { AppText } from "@/components/ui";
import { changeLabel } from "@/features/course/format";
import { colors, radius, space } from "@/theme";

import { PlaceThumb } from "./PlaceThumb";

type Props = { item: AttractionItem; dayIndex: number };

/** 피그마 F1 "현재 장소" 카드 — 변경 라벨(기본 추천·민지 추가·서현 교체), 썸네일, 이름 */
export function CurrentPlaceCard({ item, dayIndex }: Props) {
  const label = changeLabel(item);
  const friend = label.tone === "friend";
  return (
    <View style={styles.card} accessible accessibilityLabel={`현재 장소 ${item.name}, ${label.text}`}>
      <View style={[styles.chip, friend ? styles.chipFriend : styles.chipBase]}>
        <AppText variant="caption" color={friend ? "blue" : "darkgreen"}>
          {label.text}
        </AppText>
      </View>
      <View style={styles.row}>
        <PlaceThumb url={item.thumbnailUrl} label={item.name} />
        <View style={styles.texts}>
          <AppText variant="taskTitle" numberOfLines={2}>
            {item.name}
          </AppText>
          <AppText variant="small12" color="muted">
            {`${dayIndex + 1}일차 · 선택된 일정의 장소`}
          </AppText>
        </View>
      </View>
      <AppText variant="small13" color="muted">
        기존 장소를 유지하거나 아래 후보로 바꿀 수 있어요.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space[16], gap: space[12], backgroundColor: colors.white },
  chip: { alignSelf: "flex-start", height: 24, paddingHorizontal: 10, borderRadius: radius.sm, justifyContent: "center" },
  chipBase: { backgroundColor: colors.mint },
  chipFriend: { backgroundColor: colors.paleblue },
  row: { flexDirection: "row", gap: space[12], alignItems: "center" },
  texts: { flex: 1, gap: 2 },
});
