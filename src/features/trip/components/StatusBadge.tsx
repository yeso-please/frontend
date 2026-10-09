import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { AppText } from "@/components/ui";
import { colors, type ColorName, radius, space } from "@/theme";

export type TaskState = "complete" | "current" | "pending";

/** 피그마 Status Badge — Complete "완료" mint/darkgreen · Current "다음 단계" paleblue/blue · Pending "시작 전" surface/muted */
export const STATUS_BADGE: Record<TaskState, { label: string; bg: string; fg: ColorName }> = {
  complete: { label: "완료", bg: colors.mint, fg: "darkgreen" },
  current: { label: "다음 단계", bg: colors.paleblue, fg: "blue" },
  pending: { label: "시작 전", bg: colors.surface, fg: "muted" },
};

/** 상태가 바뀌면 이전 배지는 흐려지고 새 배지가 나타납니다 (오른쪽 정렬로 겹쳐서 교차). */
export function StatusBadge({ state }: { state: TaskState }) {
  const badge = STATUS_BADGE[state];
  return (
    <View style={styles.slot} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View key={state} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={[styles.badge, { backgroundColor: badge.bg }]}>
        <AppText variant="badge" color={badge.fg}>
          {badge.label}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { width: 72, height: 24, justifyContent: "center" },
  badge: {
    position: "absolute",
    right: 0,
    paddingHorizontal: space[8],
    paddingVertical: space[4],
    borderRadius: radius.sm,
  },
});
