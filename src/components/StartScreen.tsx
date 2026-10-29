import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { colors, motion } from "@/theme";

// 피그마 시작화면 648:7607 스플래시 · 648:7618 로딩 (390×844 프레임 좌표, dp).
// 그림자·흐림 효과가 있어 크롬으로 피그마와 같게 그려 3배 PNG로 잘라 썼습니다 (_local/figma-extra/2026-10-29/start/render.py).
const FRAME = { cx: 195, cy: 422 } as const;
const PIN = { x: 160, y: 266.67, w: 72.67, h: 88.67 } as const;
const WORD = { x: 130.33, y: 396, w: 125.67, h: 36.67 } as const;
const TAGLINE = { x: 102.67, y: 479, w: 187.33, h: 56.33 } as const;
const DOTS = [
  { x: 202.33, y: 334, w: 19.67, h: 21, source: require("@/assets/images/start/dot1.png") },
  { x: 222.67, y: 335.33, w: 17, h: 18, source: require("@/assets/images/start/dot2.png") },
  { x: 240.33, y: 336.33, w: 15, h: 16.33, source: require("@/assets/images/start/dot3.png") },
] as const;
/** 로딩 화면에서 핀이 왼쪽으로 비켜 점 세 개 자리를 만듭니다 (162.13 → 138.40) */
const LOADING_SHIFT = -23.73;
/** 기본 스플래시(화면 가운데 핀)에서 피그마 핀 자리까지 올라가는 거리 */
const PIN_RISE = FRAME.cy - (PIN.y + PIN.h / 2);

/** 스플래시를 적어도 이만큼 보여 줍니다. 그때까지 준비가 안 끝났으면 로딩 화면으로 바뀝니다. */
const MIN_MS = 1200;
const EXIT_MS = 320;
const DOT_CYCLE_MS = 1100;

type Props = {
  /** 글꼴·로그인 복구가 끝나 앱을 보여 줄 수 있는지 */
  ready: boolean;
  /** 첫 그림이 화면에 나왔을 때 (이때 기본 스플래시를 내립니다) */
  onShown: () => void;
  /** 사라지는 연출까지 끝났을 때 */
  onDone: () => void;
};

/**
 * 앱 시작화면. 기본 스플래시(가운데 핀) → 핀이 올라가며 TriPin·문구가 나타나는 스플래시 →
 * 준비가 늦으면 배경 빛과 점 세 개가 깜빡이는 로딩 → 준비되면 서서히 사라져 앱이 보입니다.
 */
export function StartScreen({ ready, onShown, onDone }: Props) {
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [minPassed, setMinPassed] = useState(false);
  // 적어도 MIN_MS가 지났고 앱이 준비됐으면 사라집니다.
  const exiting = minPassed && ready;
  const shown = useRef(false);
  const exitStarted = useRef(false);

  const intro = useSharedValue(0);
  const loading = useSharedValue(0);
  const exit = useSharedValue(0);
  const dotClock = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => setMinPassed(true), MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!minPassed || exitStarted.current) return;
    if (exiting) {
      exitStarted.current = true;
      exit.set(
        withTiming(1, { duration: EXIT_MS, easing: Easing.out(Easing.quad) }, (finished) => {
          if (finished) scheduleOnRN(onDone);
        }),
      );
    } else if (loading.get() === 0) {
      loading.set(withTiming(1, motion.timing.slow));
      if (!reducedMotion) dotClock.set(withRepeat(withTiming(1, { duration: DOT_CYCLE_MS, easing: Easing.linear }), -1, false));
    }
  }, [minPassed, exiting, exit, loading, dotClock, reducedMotion, onDone]);

  const handleShown = () => {
    if (shown.current) return;
    shown.current = true;
    onShown();
    intro.set(reducedMotion ? 1 : withDelay(60, withSpring(1, motion.spring.gentle)));
  };

  // 피그마 프레임 좌표 → 화면 좌표 (가운데 기준)
  const place = (box: { x: number; y: number; w: number; h: number }) => ({
    position: "absolute" as const,
    left: width / 2 + (box.x - FRAME.cx),
    top: height / 2 + (box.y - FRAME.cy),
    width: box.w,
    height: box.h,
  });

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const backgroundStyle = useAnimatedStyle(() => ({ opacity: loading.value }));
  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: loading.value * LOADING_SHIFT }, { translateY: (1 - intro.value) * PIN_RISE }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0.3, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: (1 - intro.value) * 10 }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0.5, 1], [0, 1], Extrapolation.CLAMP) * (1 - loading.value),
    transform: [{ translateY: (1 - intro.value) * 14 }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      pointerEvents={exiting ? "none" : "auto"}
      accessible
      accessibilityLabel="TriPin을 시작하는 중이에요"
    >
      <Animated.View style={[StyleSheet.absoluteFill, backgroundStyle]}>
        <Image source={require("@/assets/images/start/loading-bg.webp")} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
      {DOTS.map((dot, i) => (
        <LoadingDot key={i} index={i} style={place(dot)} source={dot.source} loading={loading} clock={dotClock} />
      ))}
      <Animated.View style={[place(PIN), pinStyle]}>
        <Image source={require("@/assets/images/start/pin.png")} style={StyleSheet.absoluteFill} onDisplay={handleShown} />
      </Animated.View>
      <Animated.View style={[place(WORD), wordStyle]}>
        <Image source={require("@/assets/images/start/wordmark.png")} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[place(TAGLINE), taglineStyle]}>
        <Image source={require("@/assets/images/start/tagline.png")} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  );
}

/** 로딩 점 하나 — 왼쪽부터 차례로 밝아지며 살짝 튀어 오릅니다. */
function LoadingDot({
  index,
  style,
  source,
  loading,
  clock,
}: {
  index: number;
  style: object;
  source: number;
  loading: SharedValue<number>;
  clock: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    // 한 바퀴 안에서 점마다 0.18씩 늦게 올라왔다 내려갑니다.
    const t = (clock.value - index * 0.18 + 1) % 1;
    const bump = t < 0.4 ? Math.sin((t / 0.4) * Math.PI) : 0;
    return {
      opacity: loading.value * (0.45 + 0.55 * bump),
      transform: [{ translateY: -3 * bump }, { scale: interpolate(loading.value, [0, 1], [0.4, 1]) }],
    };
  });
  return (
    <Animated.View style={[style, animatedStyle]}>
      <Image source={source} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.white, zIndex: 10 },
});
