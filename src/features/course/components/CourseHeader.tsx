import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useEffect } from "react";

import { AppText, PressableScale } from "@/components/ui";
import { diffDays, formatLong, formatNights } from "@/lib/date";
import { colors, radius, space } from "@/theme";

import { initial } from "../format";

const AVATAR = 40;
const TONES = [
  { bg: colors.mint, fg: "darkgreen" },
  { bg: colors.paleblue, fg: "blue" },
  { bg: colors.surface, fg: "charcoal" },
] as const;

type Props = {
  title: string;
  startDate: string;
  endDate: string;
  travelers: string[];
  /** "…" 참여자 설정 (없으면 숨김) */
  onSettings?: () => void;
  /** 아바타 아래 한 줄 — live면 파란 점이 깜빡입니다 ("민지가 보고 있어요") */
  line?: { text: string; live?: boolean } | null;
};

function LiveDot() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(0.35, { duration: 900 }), -1, true));
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** 피그마 E1 Trip identity — 여행 이름·날짜·박수·함께하는 사람·접속 표시 */
export function CourseHeader({ title, startDate, endDate, travelers, onSettings, line }: Props) {
  const nights = diffDays(startDate, endDate);
  const shown = travelers.slice(0, 4);
  return (
    <View style={styles.wrap}>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      <View style={styles.dates}>
        <AppText variant="small13" color="muted">
          {`${formatLong(startDate)}${startDate === endDate ? "" : `  –  ${formatLong(endDate)}`}`}
        </AppText>
      </View>
      <AppText variant="small13Medium" color="darkgreen">
        {formatNights(nights)}
      </AppText>

      <View style={styles.travelers}>
        <View style={styles.avatars} accessible accessibilityLabel={`함께하는 여행자 ${travelers.join(", ")}`}>
          {shown.map((name, i) => {
            const tone = TONES[i % TONES.length];
            return (
              <View key={`${name}-${i}`} style={[styles.avatar, { backgroundColor: tone.bg }]}>
                <AppText variant="label" color={tone.fg}>
                  {initial(name)}
                </AppText>
              </View>
            );
          })}
          {travelers.length > shown.length ? (
            <AppText variant="small12" color="muted">{`+${travelers.length - shown.length}`}</AppText>
          ) : null}
        </View>
        <AppText variant="small12" color="charcoal" numberOfLines={1} style={styles.names}>
          {travelers.join(" · ")}
        </AppText>
        {onSettings ? (
          <PressableScale onPress={onSettings} style={styles.more} accessibilityRole="button" accessibilityLabel="참여자 관리">
            <View style={styles.moreDots}>
              <View style={styles.moreDot} />
              <View style={styles.moreDot} />
              <View style={styles.moreDot} />
            </View>
          </PressableScale>
        ) : null}
      </View>

      {line ? (
        <Animated.View key={line.text} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={styles.line}>
          {line.live ? <LiveDot /> : null}
          <AppText variant="small12" color="blue">
            {line.text}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  dates: { flexDirection: "row", marginTop: space[4] },
  travelers: { flexDirection: "row", alignItems: "center", gap: space[8], marginTop: space[12] },
  avatars: { flexDirection: "row", alignItems: "center", gap: space[8] },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: "center", justifyContent: "center" },
  names: { flex: 1 },
  more: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  moreDots: { flexDirection: "row", gap: 4 },
  moreDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.charcoal },
  line: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space[8] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },
});
