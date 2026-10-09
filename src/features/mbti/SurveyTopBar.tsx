import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AppText, ProgressBar, TopBar } from "@/components/ui";
import { colors, screenPadding } from "@/theme";

type Props = {
  /** "3 / 12", "12 / 12", "완료" */
  counter: string;
  /** 0~1 */
  progress: number;
  /** S3 분석 단계: 진행바가 green으로 바뀝니다 */
  complete?: boolean;
  onBack: () => void;
  showBack?: boolean;
};

/** 피그마 TriPin/Survey/Top Bar (400:984) — 앱바 48 + 진행 트랙(top 60, h4) = 76 */
export function SurveyTopBar({ counter, progress, complete, onBack, showBack = true }: Props) {
  return (
    <View>
      <TopBar
        title="취향 설문"
        onBack={onBack}
        showBack={showBack}
        right={
          <Animated.View key={counter} entering={FadeIn.duration(180)}>
            <AppText variant="caption" color="blue" accessibilityLabel={complete ? "설문 완료" : `12문항 중 ${counter.split(" / ")[0]}번째`}>
              {counter}
            </AppText>
          </Animated.View>
        }
      />
      <View style={styles.track}>
        <ProgressBar progress={progress} color={complete ? colors.green : colors.blue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { paddingHorizontal: screenPadding, paddingTop: 12, paddingBottom: 12 },
});
