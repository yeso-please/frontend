import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

import { screenPadding, space } from "@/theme";

/** 단계 본문 스크롤. 슬라이더 Pan 제스처와 세로 스크롤이 부딪히지 않도록 RNGH ScrollView를 씁니다. */
export function StepScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[32] + 8, paddingBottom: space[32], gap: space[32] },
});
