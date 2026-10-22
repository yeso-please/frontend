import { ScrollView, StyleSheet, View } from "react-native";

import { AppText, PressableScale } from "@/components/ui";
import { colors, radius, space } from "@/theme";

type Props = {
  days: { dayIndex: number }[];
  value: number;
  onChange: (dayIndex: number) => void;
};

/** 일차 탭 (D19 — days[] 전체). 3일 이하는 칸을 나눠 채우고, 더 길면 가로로 넘깁니다 */
export function DayTabs({ days, value, onChange }: Props) {
  const fill = days.length <= 3;
  const tabs = days.map((day) => {
    const selected = day.dayIndex === value;
    return (
      <PressableScale
        key={day.dayIndex}
        onPress={() => onChange(day.dayIndex)}
        haptic={selected ? false : "tick"}
        style={[styles.tab, fill ? styles.fill : styles.fixed, selected && styles.selected]}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={`${day.dayIndex + 1}일차`}
      >
        <AppText variant={selected ? "small13Bold" : "small13"} color={selected ? "darkgreen" : "muted"}>
          {`${day.dayIndex + 1}일차`}
        </AppText>
      </PressableScale>
    );
  });

  if (fill) {
    return (
      <View style={styles.row} accessibilityRole="tablist">
        {tabs}
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {tabs}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space[8] },
  tab: { height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  fill: { flex: 1 },
  fixed: { width: 92 },
  selected: { backgroundColor: colors.mint },
});
