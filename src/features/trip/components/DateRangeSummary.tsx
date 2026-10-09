import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { diffDays, formatLong, formatNights } from "@/lib/date";
import { colors, motion, radius, space } from "@/theme";

type Props = { start: string | null; end: string | null };

function texts(start: string | null, end: string | null) {
  if (!start) return { title: "출발할 날을 골라 주세요", sub: "시작일과 종료일을 차례로 눌러요", complete: false };
  if (!end) return { title: `${formatLong(start)} — 언제까지?`, sub: "같은 날을 한 번 더 누르면 당일 여행이에요", complete: false };
  const nights = diffDays(start, end);
  return {
    title: nights === 0 ? formatLong(start) : `${formatLong(start)} — ${formatLong(end)}`,
    sub: nights === 0 ? "당일 · 하루 동안의 새로운 발견" : `${formatNights(nights)} · ${nights + 1}일 동안의 새로운 발견`,
    complete: true,
  };
}

/** 피그마 TriPin/Calendar/Date range summary — 기간을 다 고르면 mint로 채워집니다. */
export function DateRangeSummary({ start, end }: Props) {
  const { title, sub, complete } = texts(start, end);
  const filled = useSharedValue(complete ? 1 : 0);
  useEffect(() => {
    filled.set(withTiming(complete ? 1 : 0, motion.timing.base));
  }, [complete, filled]);
  const fillStyle = useAnimatedStyle(() => ({ opacity: filled.get() }));

  return (
    <View style={styles.card} accessible accessibilityRole="summary" accessibilityLabel={`${title}. ${sub}`} accessibilityLiveRegion="polite">
      <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]} />
      <Icons.CalendarSummary width={24} height={24} />
      <Animated.View key={title} entering={FadeIn.duration(220)} style={styles.texts}>
        <AppText variant="bold14" color={complete ? "charcoal" : "muted"}>
          {title}
        </AppText>
        <AppText variant="small12" color={complete ? "darkgreen" : "muted"}>
          {sub}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  fill: { ...StyleSheet.absoluteFill, borderRadius: radius.lg, backgroundColor: colors.mint },
  texts: { flex: 1, gap: 2 },
});
