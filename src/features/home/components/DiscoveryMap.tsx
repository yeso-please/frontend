import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle, useDerivedValue } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { colors, radius, shadows } from "@/theme";

import type { PinValues } from "../hooks/usePinChoreography";
import { type HomeGeometry, mapTransform, PIN, projectOnScreen, SHEET } from "../lib/geometry";

const KOREA_MAP = require("@/assets/illustrations/korea-map.webp");

// 피그마 TriPin/Map pin 그림자: drop-shadow (1, 5) blur 5, rgba(8, 51, 26, 0.46). Android(RN 0.76+) filter로 그립니다.
const PIN_SHADOW = "drop-shadow(1px 5px 2.5px rgba(8, 51, 26, 0.46))";
// 피그마 Selected area glow 54×26 — 핀 끝보다 2 왼쪽, 9 아래가 중심
const GLOW = { width: 54, height: 26, dx: -2, dy: 9 } as const;
/** 라벨을 핀 위 가운데에 두기 위한 넓은 상자 (말풍선은 그 안에서 가운데 정렬) */
const LABEL_BOX = 220;

/** 지도·핀이 함께 읽는 화면 상태 */
export type MapStage = {
  /** 0 = 큰 지도(01), 1 = 작은 지도(02~04) */
  progress: SharedValue<number>;
  /** 바텀시트 위치 -1 닫힘 · 0 접힘 · 1 펼침 */
  sheetIndex: SharedValue<number>;
  /** 결과 화면에서 핀이 보이도록 지도를 옮기는 거리 (접힘·펼침) */
  focusCompact: SharedValue<number>;
  focusExpanded: SharedValue<number>;
};

/** 3D 한국 지도. 크기 변화는 width/height가 아니라 transform(scale·translate)으로만 움직입니다. */
export function MapLayer({ geo, stage, accessibilityLabel }: { geo: HomeGeometry; stage: MapStage; accessibilityLabel: string }) {
  const { progress, sheetIndex, focusCompact, focusExpanded } = stage;
  const animatedStyle = useAnimatedStyle(() => {
    const t = mapTransform(geo, progress.value, sheetIndex.value, focusCompact.value, focusExpanded.value);
    return {
      // 시트를 펼치면(04) 지도가 살짝 작아지고 흐려져 시트 내용에 시선이 갑니다.
      opacity: interpolate(sheetIndex.value, [0, 1], [1, SHEET.expandedMapOpacity], Extrapolation.CLAMP),
      transform: [{ translateX: t.tx }, { translateY: t.ty }, { scale: t.k }],
    };
  });

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[{ position: "absolute", left: geo.cx - geo.w / 2, top: geo.cy - geo.h / 2, width: geo.w, height: geo.h }, animatedStyle]}
    >
      <Image source={KOREA_MAP} style={StyleSheet.absoluteFill} contentFit="contain" priority="high" />
    </Animated.View>
  );
}

/** 핀·바닥 그림자·글로우·지역 라벨. 지도와 같은 변환을 따라 화면 좌표에 그립니다 (지도와 함께 줄어들지 않음). */
export function PinLayer({ geo, stage, pin, label }: { geo: HomeGeometry; stage: MapStage; pin: PinValues; label: string | null }) {
  const { progress, sheetIndex, focusCompact, focusExpanded } = stage;

  // 핀 끝(지면에 닿는 점)의 화면 좌표
  const tip = useDerivedValue(() => {
    const t = mapTransform(geo, progress.value, sheetIndex.value, focusCompact.value, focusExpanded.value);
    return projectOnScreen(geo, t, pin.u.value, pin.v.value);
  });

  const groundStyle = useAnimatedStyle(() => {
    const p = tip.value;
    const lift = pin.lift.value;
    return {
      opacity: pin.opacity.value * interpolate(lift, [-150, 0], [0.08, 0.28], Extrapolation.CLAMP),
      transform: [{ translateX: p.x - 11 }, { translateY: p.y - 3 }, { scale: interpolate(lift, [-150, 0], [0.4, 1], Extrapolation.CLAMP) }],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const p = tip.value;
    const g = pin.glow.value;
    return {
      opacity: g,
      transform: [{ translateX: p.x + GLOW.dx - GLOW.width / 2 }, { translateY: p.y + GLOW.dy - GLOW.height / 2 }, { scale: 0.6 + 0.4 * g }],
    };
  });

  // 퍼져 나가며 사라지는 고리 (withRepeat: scale ↑, opacity ↓)
  const pulseStyle = useAnimatedStyle(() => {
    const p = tip.value;
    const k = pin.pulse.value;
    return {
      opacity: pin.glow.value * (1 - k) * 0.7,
      transform: [{ translateX: p.x + GLOW.dx - GLOW.width / 2 }, { translateY: p.y + GLOW.dy - GLOW.height / 2 }, { scale: 1 + k * 0.9 }],
    };
  });

  const pinStyle = useAnimatedStyle(() => {
    const p = tip.value;
    const squash = pin.squash.value;
    return {
      opacity: pin.opacity.value,
      transform: [
        { translateX: p.x - PIN.width / 2 },
        { translateY: p.y - PIN.tipY + pin.lift.value },
        // 눌릴 때 옆으로 퍼져 부피가 유지되는 느낌
        { scaleX: 1 + (1 - squash) * 0.6 },
        { scaleY: squash },
      ],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const p = tip.value;
    const l = pin.label.value;
    return {
      opacity: Math.min(1, Math.max(0, l)),
      transform: [
        { translateX: p.x - LABEL_BOX / 2 },
        { translateY: p.y - PIN.labelOffset + pin.lift.value + (1 - l) * 8 },
        { scale: 0.6 + 0.4 * l },
      ],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={[styles.ground, groundStyle]} />
      <Animated.View style={[styles.layer, styles.pulse, pulseStyle]} />
      <Animated.View style={[styles.layer, glowStyle]}>
        <Icons.SelectedAreaGlow width={GLOW.width} height={GLOW.height} />
      </Animated.View>
      <Animated.View style={[styles.layer, styles.pin, pinStyle]}>
        <Icons.PinDestination width={PIN.width} height={PIN.height} />
      </Animated.View>
      <Animated.View style={[styles.layer, styles.labelBox, labelStyle]}>
        {label ? (
          <View style={styles.label}>
            <AppText variant="caption" color="darkgreen" numberOfLines={1}>
              {label}
            </AppText>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 0, top: 0 },
  ground: { position: "absolute", left: 0, top: 0, width: 22, height: 7, borderRadius: radius.pill, backgroundColor: colors.charcoal },
  pulse: { width: GLOW.width, height: GLOW.height, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.green, backgroundColor: colors.glow },
  pin: { width: PIN.width, height: PIN.height, transformOrigin: "50% 96%", filter: PIN_SHADOW },
  labelBox: { width: LABEL_BOX, height: PIN.labelHeight, alignItems: "center", transformOrigin: "50% 100%" },
  // 피그마 Selected destination: white, r10, 그림자 2 5 10, Caption darkgreen
  label: {
    height: PIN.labelHeight,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.white,
    justifyContent: "center",
    ...shadows.label,
  },
});
