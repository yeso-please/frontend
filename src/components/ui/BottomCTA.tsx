import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, screenPadding } from "@/theme";

import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

type Props = {
  children: ReactNode;
  /** CTA 아래 보조 문구 또는 보조 액션 ("설문 다시 하기", "혼자 여행할게요") */
  helper?: string;
  onHelperPress?: () => void;
};

/** 화면 하단 고정 CTA 영역 (피그마 Preparation/Bottom CTA, Survey Fixed bottom action). 시스템 내비게이션 바 높이만큼 여백을 더합니다. */
export function BottomCTA({ children, helper, onHelperPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) + (helper ? 0 : 12) }]}>
      {children}
      {helper ? (
        onHelperPress ? (
          <PressableScale onPress={onHelperPress} style={styles.helper} accessibilityRole="button">
            <AppText variant="small12" color="muted">
              {helper}
            </AppText>
          </PressableScale>
        ) : (
          <View style={styles.helper}>
            <AppText variant="small12" color="muted">
              {helper}
            </AppText>
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 12,
    paddingHorizontal: screenPadding,
    backgroundColor: colors.white,
  },
  helper: { height: 40, alignItems: "center", justifyContent: "center" },
});
