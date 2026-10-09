import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { colors, motion, screenPadding, space } from "@/theme";

type Props = {
  title?: string;
  description?: string;
  /** 화면 아래 한 줄 (피그마 "곧, 나의 여행 성향을 만나요.") */
  footnote?: string;
};

const CIRCLE = 168;
const PIN = { width: 64, height: 61 };
const HOP = 18;
const HOP_MS = 900;

/**
 * 피그마 S3 · Analysis state (400:1074) — mint 원 + 경로 라인 + 통통 튀는 핀 + 순차 점멸 점 3개.
 * 온보딩 제출 대기와 여행 MBTI 분석에서 같이 씁니다.
 */
export function AnalysisView({
  title = "여행 취향을\n정리하고 있어요",
  description = "고른 답을 모아,\n나만의 여행 방식을 찾는 중이에요.",
  footnote = "곧, 나의 여행 성향을 만나요.",
}: Props) {
  const insets = useSafeAreaInsets();
  // 0→1 한 주기: 0~0.7 공중, 0.7~1 착지하며 살짝 눌림
  const t = useSharedValue(0);
  const dots = useSharedValue(0);

  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: HOP_MS, easing: Easing.linear }), -1, false));
    dots.set(withRepeat(withTiming(3, { duration: 1500, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(t);
      cancelAnimation(dots);
    };
  }, [t, dots]);

  const pinStyle = useAnimatedStyle(() => {
    const p = t.value;
    if (p < 0.7) {
      return { transform: [{ translateY: -HOP * Math.sin((Math.PI * p) / 0.7) }, { scaleX: 1 }, { scaleY: 1 }] };
    }
    const squash = Math.sin((Math.PI * (p - 0.7)) / 0.3);
    return { transform: [{ translateY: 0 }, { scaleX: 1 + 0.08 * squash }, { scaleY: 1 - 0.1 * squash }] };
  });

  const glowStyle = useAnimatedStyle(() => {
    const p = t.value;
    const height = p < 0.7 ? Math.sin((Math.PI * p) / 0.7) : 0;
    return { opacity: 1 - 0.6 * height, transform: [{ scale: 1 - 0.4 * height }] };
  });

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, space[24]) }]} accessible accessibilityRole="progressbar" accessibilityLabel={title.replace("\n", " ")}>
      <View style={styles.center}>
        <Animated.View entering={ZoomIn.springify().damping(motion.spring.gentle.damping)} style={styles.illustration}>
          <Icons.AnalysisBackdrop width={CIRCLE} height={CIRCLE} style={StyleSheet.absoluteFill} />
          <Animated.View entering={FadeIn.delay(220).duration(500)} style={styles.route}>
            <Icons.AnalysisRoute width={96} height={96} />
          </Animated.View>
          <Animated.View style={[styles.glow, glowStyle]}>
            <Icons.SelectedAreaGlow width={54} height={26} />
          </Animated.View>
          <Animated.View style={[styles.pin, pinStyle]}>
            <Icons.PinDestination width={PIN.width} height={PIN.height} />
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger * 2).springify()} style={styles.copy}>
          <AppText variant="title" align="center">
            {title}
          </AppText>
          <AppText variant="body" color="muted" align="center">
            {description}
          </AppText>
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <Dot key={i} index={i} progress={dots} />
            ))}
          </View>
        </Animated.View>
      </View>

      {footnote ? (
        <Animated.View entering={FadeIn.delay(400)}>
          <AppText variant="caption" color="muted" align="center">
            {footnote}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** 점 3개가 차례로 green으로 차올랐다 빠집니다 (피그마: 첫 점 green, 나머지 border색) */
function Dot({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const d = (((progress.value - index) % 3) + 3) % 3;
    const on = d < 1 ? Math.sin(d * Math.PI) : 0;
    return {
      backgroundColor: interpolateColor(on, [0, 1], [colors.border, colors.green]),
      transform: [{ scale: 1 + 0.35 * on }],
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: screenPadding },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space[32] + 12, paddingBottom: space[32] },
  illustration: { width: CIRCLE, height: CIRCLE },
  // 피그마 좌표 (원 기준): 경로 (36, 66), 핀 (52, 32), 핀 끝 ≈ y 90
  route: { position: "absolute", left: 36, top: 66 },
  glow: { position: "absolute", left: (CIRCLE - 54) / 2, top: 78 },
  pin: { position: "absolute", left: (CIRCLE - PIN.width) / 2, top: 32, transformOrigin: "50% 100%" },
  copy: { alignItems: "center", gap: space[12] },
  dots: { flexDirection: "row", gap: 8, marginTop: space[4], height: 12, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
