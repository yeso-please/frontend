import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

import { AppText } from "@/components/ui";
import { screenPadding } from "@/theme";

import type { DiscoverPhase, DrawMode } from "../store";

type Props = {
  phase: DiscoverPhase;
  mode: DrawMode;
  /** B3에서 초록색으로 강조할 지역 이름 */
  resultName: string | null;
  /** 조건 뽑기를 켰는지 (B1 부제가 바뀝니다) */
  conditional: boolean;
  /** 핀 꽂기를 꾹 누르고 있는지 */
  holding: boolean;
};

/** 헤드라인 + 부제 (피그마 Intro 24,118). 상태가 바뀌면 이전 문구는 위로 사라지고 새 문구가 아래에서 올라옵니다. */
export function DiscoverIntro({ phase, mode, resultName, conditional, holding }: Props) {
  const found = phase === "found" && resultName;
  // 직접 고른 지역은 바로 떨어지므로 "찾고 있어요" 문구를 건너뜁니다.
  const drawing = phase === "drawing" && mode === "random";
  const key = found ? `found-${resultName}` : drawing ? "drawing" : holding ? "holding" : `idle-${conditional}`;

  return (
    <View style={styles.slot}>
      <Animated.View key={key} entering={FadeInDown.duration(380)} exiting={FadeOutUp.duration(200)} style={styles.block} accessibilityLiveRegion="polite">
        {found ? (
          // B3 Headline 30/41
          <AppText variant="headline" numberOfLines={2} accessibilityRole="header">
            이번엔, <AppText variant="headline" color="green">{resultName}</AppText> 어때요?
          </AppText>
        ) : (
          // B1·B2 Title 26/36
          <AppText variant="title" accessibilityRole="header">
            {drawing ? "당신의 다음 여행지를\n찾고 있어요." : holding ? "놓는 순간,\n핀이 날아가요!" : "이번엔 어디로 떠나볼까?"}
          </AppText>
        )}
        <AppText variant="body" color="muted">
          {found
            ? "마음에 든다면, 나만의 여행으로."
            : drawing
              ? "우연이 데려다줄 곳을 만나보세요."
              : holding
                ? "지도가 출렁이는 동안 힘이 모여요."
                : conditional
                  ? "핀 꽂기를 꾹 눌렀다 놓으면 내 취향을 담아 날아가요."
                  : "핀 꽂기를 꾹 눌렀다 놓으면 핀이 날아가요."}
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
