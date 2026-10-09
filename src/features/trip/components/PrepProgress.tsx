import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AppText, PressableScale, ProgressBar } from "@/components/ui";
import { colors, space } from "@/theme";

import { PROGRESS_SEGMENT_HEIGHT } from "../constants";

type Props = {
  done: number;
  total: number;
  /** 진행바 아래 blue 안내 ("이제 여행 날짜를 정해볼까요?") */
  hint: string;
  onHintPress?: () => void;
};

/** 피그마 TriPin/Preparation/Progress — "차근차근, 여행 준비 중" + "n / 3 완료" + 3분할 막대 */
export function PrepProgress({ done, total, hint, onHintPress }: Props) {
  // 처음 그릴 때도 채워지는 움직임이 보이도록 한 박자 늦게 값을 넘깁니다.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setShown(done), 220);
    return () => clearTimeout(timer);
  }, [done]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <AppText variant="bold14">차근차근, 여행 준비 중</AppText>
        <AppText variant="caption" color="darkgreen">
          {done} / {total} 완료
        </AppText>
      </View>

      <View style={styles.segments} accessible accessibilityRole="progressbar" accessibilityLabel={`여행 준비 ${total}단계 중 ${done}단계 완료`}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={styles.segment} importantForAccessibility="no-hide-descendants">
            <ProgressBar progress={i < shown ? 1 : 0} color={colors.green} trackColor={colors.border} height={PROGRESS_SEGMENT_HEIGHT} />
          </View>
        ))}
      </View>

      <Animated.View key={hint} entering={FadeIn.duration(240)}>
        <PressableScale onPress={onHintPress} disabled={!onHintPress} haptic="tick" hitSlop={{ top: 12, bottom: 12 }} accessibilityRole="link" style={styles.hint}>
          <AppText variant="small12" color="blue">
            {hint}
          </AppText>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[12] },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  segments: { flexDirection: "row", gap: space[8] },
  segment: { flex: 1 },
  hint: { alignSelf: "flex-start" },
});
