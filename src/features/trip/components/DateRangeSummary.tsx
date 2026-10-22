import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { AppText } from "@/components/ui";
import { diffDays, formatLong, formatNights } from "@/lib/date";
import { colors, motion, radius, space } from "@/theme";

type Props = { start: string | null; end: string | null };

/** 피그마 C7 Selected dates summary — 시작일 – 종료일 / "2박 3일". 기간을 다 고르면 mint로 채워집니다. */
export function DateRangeSummary({ start, end }: Props) {
  const complete = !!start && !!end;
  const filled = useSharedValue(complete ? 1 : 0);
  useEffect(() => {
    filled.set(withTiming(complete ? 1 : 0, motion.timing.base));
  }, [complete, filled]);
  const fillStyle = useAnimatedStyle(() => ({ opacity: filled.get() }));

  const nights = start && end ? diffDays(start, end) : null;
  const label = !start
    ? "출발할 날을 골라 주세요"
    : !end
      ? `${formatLong(start)}부터, 돌아올 날을 골라 주세요`
      : `${formatLong(start)}부터 ${formatLong(end)}까지, ${formatNights(nights ?? 0)}`;

  return (
    <View style={styles.card} accessible accessibilityRole="summary" accessibilityLabel={label} accessibilityLiveRegion="polite">
      <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]} />
      <View style={styles.row}>
        <AppText variant="small13" color={start ? "darkgreen" : "muted"} style={styles.side}>
          {start ? formatLong(start) : "출발일"}
        </AppText>
        <AppText variant="small13" color="muted">
          –
        </AppText>
        <AppText variant="small13" color={end ? "darkgreen" : "muted"} align="right" style={styles.side}>
          {end ? formatLong(end) : "도착일"}
        </AppText>
      </View>
      <Animated.View key={nights ?? "none"} entering={FadeIn.duration(220)}>
        <AppText variant="cardTitle" color={complete ? "darkgreen" : "muted"} align="center">
          {nights != null ? formatNights(nights) : start ? "언제까지 머물까요?" : "날짜를 골라 주세요"}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 90,
    justifyContent: "center",
    gap: space[8],
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  fill: { ...StyleSheet.absoluteFill, borderRadius: radius.lg, backgroundColor: colors.mint },
  row: { flexDirection: "row", alignItems: "center", gap: space[8] },
  side: { flex: 1 },
});
