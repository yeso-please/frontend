import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";

import type { DrawCondition } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, Button, PressableScale, SelectableChip } from "@/components/ui";
import { colors, motion, radius, shadows, sizes, space } from "@/theme";

type Props = {
  top: number;
  conditions: DrawCondition[];
  onClose: () => void;
  /** 고른 조건을 저장하고 바로 핀을 꽂습니다 */
  onApply: (conditions: DrawCondition[]) => void;
};

/**
 * 피그마 B1 숨김 레이어 Region conditions (24,270 · 342×248): 제목·닫기, 조건 칩, 안내, 확인 버튼.
 * 서버 조건 추첨(7-5 CONDITIONAL)은 거리(DISTANCE)·내 취향(MY_TASTE)뿐이고(디자인의 바다·도시·자연 칩은 Q9로 보류),
 * 앱은 위치 권한(expo-location)이 없어 거리 조건 없이 "완전 랜덤 / 내 취향"만 고릅니다.
 */
export function ConditionCard({ top, conditions, onClose, onApply }: Props) {
  const [taste, setTaste] = useState(conditions.includes("MY_TASTE"));

  return (
    <>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={styles.dimmer}>
        <PressableScale onPress={onClose} haptic={false} scaleTo={1} style={StyleSheet.absoluteFill} accessibilityLabel="조건 닫기" />
      </Animated.View>
      <Animated.View
        entering={ZoomIn.springify().damping(motion.spring.gentle.damping).stiffness(motion.spring.gentle.stiffness)}
        exiting={ZoomOut.duration(160)}
        style={[styles.card, { top }]}
        accessibilityViewIsModal
      >
        <View style={styles.heading}>
          <AppText variant="label" accessibilityRole="header" style={styles.flex}>
            어떤 곳에 핀을 꽂을까요?
          </AppText>
          <PressableScale onPress={onClose} haptic="tick" style={styles.close} accessibilityRole="button" accessibilityLabel="닫기">
            <Icons.Close width={22} height={22} />
          </PressableScale>
        </View>
        <View style={styles.chips} accessibilityRole="radiogroup">
          <SelectableChip label="완전 랜덤" selected={!taste} onPress={() => setTaste(false)} />
          <SelectableChip label="내 취향" selected={taste} onPress={() => setTaste(true)} />
        </View>
        <AppText variant="caption" color="muted">
          {taste ? "설문으로 알게 된 취향과 닮은 지역에 핀이 더 자주 꽂혀요." : "전국 어디든, 우연이 데려다줄 곳으로 핀을 꽂아요."}
        </AppText>
        <Button label="이 조건으로 핀 꽂기" variant="primary" onPress={() => onApply(taste ? ["MY_TASTE"] : [])} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dimmer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.scrim },
  // 피그마 Region conditions: 안쪽 여백 21, 요소 간격 16
  card: {
    position: "absolute",
    left: 24,
    right: 24,
    padding: 21,
    gap: space[16],
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    ...shadows.sheet,
  },
  heading: { flexDirection: "row", alignItems: "center", minHeight: sizes.touchTarget },
  close: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: "center", justifyContent: "center", marginRight: -11 },
  chips: { flexDirection: "row", gap: space[8] },
});
