import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { colors, motion, sizes } from "@/theme";

type Props = {
  showBack: boolean;
  onBack: () => void;
  /** 0부터 시작하는 현재 단계. null이면 단계 표시를 숨깁니다 (분석·결과 화면) */
  step: number | null;
  total: number;
};

/** 피그마 온보딩 `상단`(401:942) — 좌 뒤로가기 화살표, 중앙 TriPin 로고, 아래 4칸 단계 표시 */
export function OnboardingHeader({ showBack, onBack, step, total }: Props) {
  return (
    <View>
      <View style={styles.bar}>
        <View style={styles.side}>
          {showBack ? (
            <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
              <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="이전 단계로" hitSlop={6} style={styles.back}>
                <Icons.OnbBack width={16} height={16} />
              </PressableScale>
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.logo} accessible accessibilityRole="header" accessibilityLabel="TriPin">
          <Icons.LogoPin width={29} height={28} />
          <AppText variant="logo">TriPin</AppText>
        </View>
        <View style={styles.side} />
      </View>
      <View style={styles.stepsWrap}>{step !== null ? <StepIndicator step={step} total={total} /> : null}</View>
    </View>
  );
}

const SEGMENT = { width: 16, height: 2, gap: 10 } as const;

/** 회색 선분 위로 초록 선분 하나가 스프링으로 미끄러져 현재 단계를 가리킵니다 */
function StepIndicator({ step, total }: { step: number; total: number }) {
  const x = useSharedValue(step * (SEGMENT.width + SEGMENT.gap));
  const stretch = useSharedValue(1);

  useEffect(() => {
    x.set(withSpring(step * (SEGMENT.width + SEGMENT.gap), motion.spring.snappy));
    // 이동하는 동안 살짝 늘어났다가 돌아와 "달려가는" 느낌을 줍니다
    stretch.set(withSequence(withTiming(1.8, motion.timing.fast), withSpring(1, motion.spring.snappy)));
  }, [step, x, stretch]);

  const activeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { scaleX: stretch.value }] }));

  return (
    <Animated.View
      entering={FadeIn}
      style={styles.steps}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${total}단계 중 ${step + 1}단계`}
      accessibilityValue={{ min: 1, max: total, now: step + 1 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: colors.onboardingStepInactive }]} />
      ))}
      <Animated.View style={[styles.segment, styles.active, activeStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  side: { width: sizes.touchTarget + 8, justifyContent: "center" },
  back: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: "center", justifyContent: "center" },
  logo: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  stepsWrap: { height: 18, alignItems: "center", justifyContent: "center" },
  steps: { flexDirection: "row", gap: SEGMENT.gap },
  segment: { width: SEGMENT.width, height: SEGMENT.height, borderRadius: SEGMENT.height / 2 },
  active: { position: "absolute", left: 0, top: 0, backgroundColor: colors.onboardingStep },
});
