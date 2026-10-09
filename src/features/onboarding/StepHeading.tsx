import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";

/** 온보딩 단계 제목 블록 (피그마 Bold 28/38 + Regular 16/28) */
export function StepHeading({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <AppText variant="onboardingTitle" accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="onboardingSubtitle" color="muted">
        {subtitle}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
});
