import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";

import { AppText, PressableScale } from "@/components/ui";
import { Icons } from "@/components/icons";
import { colors, motion, radius, space } from "@/theme";

type Props = {
  title: string;
  /** 제목 아래 줄들 (겹치는 여행 목록 등) */
  lines?: string[];
  tone?: "info" | "neutral";
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
};

/**
 * 화면 안에 끼워 보여주는 안내 상자. 피그마에 빨간 경고 표현이 없어(제외 조건 "No red warning treatment" 원칙)
 * 정보성 paleblue / 중립 surface 두 가지 톤만 씁니다.
 */
export function InlineNotice({ title, lines, tone = "info", actionLabel, onAction, children }: Props) {
  const info = tone === "info";
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(motion.spring.gentle.damping)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.springify()}
      style={[styles.box, { backgroundColor: info ? colors.paleblue : colors.surface }]}
      accessibilityRole="alert"
    >
      {info ? <Icons.Spark width={20} height={20} /> : null}
      <View style={styles.body}>
        <AppText variant="small13Medium" color={info ? "blue" : "charcoal"}>
          {title}
        </AppText>
        {lines?.map((line) => (
          <AppText key={line} variant="small12" color={info ? "blue" : "muted"}>
            {line}
          </AppText>
        ))}
        {children}
        {actionLabel && onAction ? (
          <PressableScale onPress={onAction} accessibilityRole="button" hitSlop={{ top: 12, bottom: 12 }} style={styles.action}>
            <AppText variant="small13Bold" color={info ? "blue" : "darkgreen"}>
              {actionLabel}
            </AppText>
          </PressableScale>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: space[8],
    padding: space[12],
    borderRadius: radius.md,
  },
  body: { flex: 1, gap: space[4] },
  action: { alignSelf: "flex-start", paddingVertical: space[4] },
});
