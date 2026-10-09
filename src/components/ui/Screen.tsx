import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 상단 상태바 영역만큼 띄울지 (홈처럼 배경이 상태바 뒤까지 깔리는 화면은 false) */
  padTop?: boolean;
  background?: string;
};

/** 화면 루트. 피그마의 iPhone 상태바 대신 Android 시스템 상태바 높이만큼 여백을 줍니다. */
export function Screen({ children, style, padTop = true, background = colors.white }: Props) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.root, { backgroundColor: background, paddingTop: padTop ? insets.top : 0 }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
