import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui";
import { colors, motion, screenPadding, space } from "@/theme";

import { MbtiProfileView } from "./MbtiProfileView";
import type { MbtiType } from "./types";

type Props = {
  type: MbtiType;
  onMakeCourse: () => void;
  onRetake: () => void;
};

/**
 * 피그마 C6 · 나의 여행 성향 — 캐릭터·유형·이름·한 줄·설명·태그·"나의 여행 취향 한눈에"와
 * 하단 "내 여행 성향으로 코스 만들기 →" / "성향검사 다시하기". 설문 결과와 MY → 나의 여행 성향이 함께 씁니다.
 */
export function PersonaResult({ type, onMakeCourse, onRetake }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MbtiProfileView type={type} />
      </ScrollView>
      <Animated.View
        entering={FadeInUp.delay(motion.stagger * 6).springify().damping(motion.spring.gentle.damping)}
        style={[styles.actions, { paddingBottom: Math.max(insets.bottom, space[12]) + space[12] }]}
      >
        <Button label="내 여행 성향으로 코스 만들기" rightIcon={<Icons.ArrowRight width={20} height={20} />} onPress={onMakeCourse} />
        <Button label="성향검사 다시하기" variant="secondary" height={48} onPress={onRetake} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: screenPadding, paddingTop: space[4], paddingBottom: space[24] },
  actions: { paddingHorizontal: screenPadding, paddingTop: space[12], gap: space[12], backgroundColor: colors.white },
});
