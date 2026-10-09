import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

import { AppText } from "@/components/ui";
import { screenPadding } from "@/theme";

import type { DrawMode, HomePhase } from "../store";

type Props = {
  phase: HomePhase;
  mode: DrawMode;
  /** 03·04에서 초록색으로 강조할 지역 이름 */
  resultName: string | null;
};

const SUBTITLE_IDLE = "핀 하나로 시작하는 새로운 여행";

/** 헤드라인 + 부제. 상태가 바뀌면 이전 문구는 위로 사라지고 새 문구가 아래에서 올라옵니다. */
export function HomeIntro({ phase, mode, resultName }: Props) {
  const found = phase === "found" && resultName;
  // 직접 고른 지역은 바로 떨어지므로 "찾고 있어요" 문구를 건너뜁니다.
  const drawing = phase === "drawing" && mode === "random";
  const key = found ? `found-${resultName}` : drawing ? "drawing" : "idle";

  return (
    <View style={styles.slot}>
      <Animated.View
        key={key}
        entering={FadeInDown.duration(380)}
        exiting={FadeOutUp.duration(200)}
        style={styles.block}
        accessibilityLiveRegion="polite"
      >
        {found ? (
          <AppText variant="headline" numberOfLines={2} accessibilityRole="header">
            이번엔, <AppText variant="headline" color="green">{resultName}</AppText> 어때요?
          </AppText>
        ) : (
          <AppText variant="headline" accessibilityRole="header">
            {drawing ? "당신의 다음 여행지를\n찾고 있어요." : "어디로 떠날지,\n우연에 맡겨봐."}
          </AppText>
        )}
        <AppText variant="body" color="muted">
          {found ? "마음에 든다면, 나만의 여행으로." : SUBTITLE_IDLE}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 피그마 Intro (24, 118, 342×112) — 앱바 아래 18
  slot: { marginTop: 18, marginHorizontal: screenPadding, height: 112 },
  block: { position: "absolute", top: 0, left: 0, right: 0, gap: 8 },
});
