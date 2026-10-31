import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Icons } from "@/components/icons";
import { colors, screenPadding, sizes } from "@/theme";

import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

type Props = {
  title?: string;
  /** 오른쪽 영역 (예: 설문 진행 카운터 "1 / 12") */
  right?: ReactNode;
  onBack?: () => void;
  /** false면 뒤로가기 버튼을 숨깁니다 */
  showBack?: boolean;
};

/** 피그마 TriPin/Preparation/Top App Bar — 좌 Back 44×44, 중앙 타이틀, 우측 44 균형 영역 */
export function TopBar({ title, right, onBack, showBack = true }: Props) {
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : undefined));
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {showBack && (
          <PressableScale onPress={handleBack} accessibilityRole="button" accessibilityLabel="뒤로 가기" style={styles.back} hitSlop={8}>
            <Icons.Back width={22} height={22} />
          </PressableScale>
        )}
      </View>
      {/* 타이틀은 양옆 너비와 상관없이 가운데에 둡니다 (오른쪽에 "임시저장" 같은 글자가 와도 줄바꿈되지 않게) */}
      <View style={styles.titleWrap} pointerEvents="none">
        <AppText variant="label" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: sizes.appBar,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: screenPadding - 14,
    backgroundColor: colors.white,
  },
  side: { minWidth: 56, justifyContent: "center" },
  right: { marginLeft: "auto", alignItems: "flex-end", paddingRight: 14 },
  back: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: "center", justifyContent: "center" },
  titleWrap: { ...StyleSheet.absoluteFill, justifyContent: "center", paddingHorizontal: 72 },
  title: { textAlign: "center" },
});
