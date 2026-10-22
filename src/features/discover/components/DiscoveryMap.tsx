import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle, useDerivedValue } from "react-native-reanimated";
import Svg, { Ellipse } from "react-native-svg";

import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { colors, radius, shadows } from "@/theme";

import type { PinValues } from "../hooks/usePinChoreography";
import { type DiscoverGeometry, mapTransform, PIN, projectOnScreen } from "../lib/geometry";

const KOREA_TERRAIN = require("@/assets/illustrations/korea-terrain.webp");

// 피그마 B3: Selected area glow 84×46 (핀 끝보다 1 오른쪽·9 아래가 중심), 지역 발자국(점선) 104×98 (4 오른쪽·3 아래)
const GLOW = { width: 84, height: 46, dx: 1, dy: 9 } as const;
const FOOTPRINT = { width: 104, height: 98, dx: 4, dy: 3 } as const;
/** 라벨 상자 폭 (말풍선은 그 안에서 왼쪽 정렬) */
const LABEL_BOX = 200;
/** 인트로 뒤 가림막 아래쪽 그라데이션 높이 */
const VEIL_FADE = 28;

/** 지도·핀이 함께 읽는 화면 상태 */
export type MapStage = {
  /** 0 = B1 기본 지도, 1 = B2 핀 모드, 2 = B3 지역 확대 */
  zoom: SharedValue<number>;
  /** B3에서 확대해 보여 줄 지역 (지도 0~1 좌표) */
  focusU: SharedValue<number>;
  focusV: SharedValue<number>;
};

/** 3D 지형 지도. 크기 변화는 width/height가 아니라 transform(scale·translate)으로만 움직입니다. */
export function MapLayer({ geo, stage, accessibilityLabel }: { geo: DiscoverGeometry; stage: MapStage; accessibilityLabel: string }) {
  const { zoom, focusU, focusV } = stage;
  const animatedStyle = useAnimatedStyle(() => {
    const t = mapTransform(geo, zoom.value, focusU.value, focusV.value);
    return { transform: [{ translateX: t.tx }, { translateY: t.ty }, { scale: t.k }] };
  });

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[{ position: "absolute", left: geo.cx - geo.w / 2, top: geo.cy - geo.h / 2, width: geo.w, height: geo.h }, animatedStyle]}
    >
      <Image source={KOREA_TERRAIN} style={StyleSheet.absoluteFill} contentFit="contain" priority="high" />
    </Animated.View>
  );
}

/** B3에서 확대한 지도가 인트로 뒤로 올라오지 않게 덮는 흰 가림막 (피그마 지도 창 위쪽 y208) */
export function IntroVeil({ geo, zoom }: { geo: DiscoverGeometry; zoom: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: interpolate(zoom.value, [1.15, 1.85], [0, 1], Extrapolation.CLAMP) }));
  return (
    <Animated.View pointerEvents="none" style={[styles.veil, { height: geo.viewportTop + VEIL_FADE }, style]}>
      <View style={[styles.veilSolid, { height: geo.viewportTop }]} />
      <LinearGradient colors={[colors.white, `${colors.white}00`]} style={styles.veilFade} />
    </Animated.View>
  );
}

/** 핀·바닥 그림자·글로우·발자국·지역 라벨. 지도와 같은 변환을 따라 화면 좌표에 그립니다. */
export function PinLayer({ geo, stage, pin, label }: { geo: DiscoverGeometry; stage: MapStage; pin: PinValues; label: string | null }) {
  const { zoom, focusU, focusV } = stage;

  // 핀 끝(지면에 닿는 점)의 화면 좌표와 핀 크기 (B3에서 56 폭으로 커집니다)
  const tip = useDerivedValue(() => {
    const t = mapTransform(geo, zoom.value, focusU.value, focusV.value);
    return projectOnScreen(geo, t, pin.u.value, pin.v.value);
  });
  const pinScale = useDerivedValue(() => interpolate(zoom.value, [1, 2], [1, PIN.foundScale], Extrapolation.CLAMP));

  const groundStyle = useAnimatedStyle(() => {
    const p = tip.value;
    const lift = pin.lift.value;
    return {
      opacity: pin.opacity.value * interpolate(lift, [-150, 0], [0.08, 0.28], Extrapolation.CLAMP),
      transform: [{ translateX: p.x - 11 }, { translateY: p.y - 3 }, { scale: interpolate(lift, [-150, 0], [0.4, 1], Extrapolation.CLAMP) * pinScale.value }],
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
      opacity: pin.glow.value * (1 - k) * 0.6,
      transform: [{ translateX: p.x + GLOW.dx - GLOW.width / 2 }, { translateY: p.y + GLOW.dy - GLOW.height / 2 }, { scale: 1 + k * 0.7 }],
    };
  });

  // 지역 발자국: 확대된 지도(B3)에서만 점선 원이 번지듯 나타납니다.
  const footprintStyle = useAnimatedStyle(() => {
    const p = tip.value;
    const shown = pin.glow.value * interpolate(zoom.value, [1.5, 2], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: shown,
      transform: [
        { translateX: p.x + FOOTPRINT.dx - FOOTPRINT.width / 2 },
        { translateY: p.y + FOOTPRINT.dy - FOOTPRINT.height / 2 },
        { scale: 0.7 + 0.3 * shown },
      ],
    };
  });

  const pinStyle = useAnimatedStyle(() => {
    const p = tip.value;
    const squash = pin.squash.value;
    const k = pinScale.value;
    return {
      opacity: pin.opacity.value,
      transform: [
        { translateX: p.x - PIN.width / 2 },
        { translateY: p.y - PIN.tipY + pin.lift.value },
        // 끝점 기준으로 키우고, 눌릴 때 옆으로 퍼져 부피가 유지되는 느낌
        { scaleX: k * (1 + (1 - squash) * 0.6) },
        { scaleY: k * squash },
      ],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const p = tip.value;
    const l = pin.label.value;
    const headRight = (PIN.width / 2) * pinScale.value;
    return {
      opacity: Math.min(1, Math.max(0, l)),
      transform: [
        { translateX: p.x + headRight + PIN.labelGap - (1 - l) * 8 },
        { translateY: p.y - PIN.labelRise + pin.lift.value },
        { scale: 0.6 + 0.4 * l },
      ],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={[styles.layer, footprintStyle]}>
        <Svg width={FOOTPRINT.width} height={FOOTPRINT.height}>
          <Ellipse
            cx={FOOTPRINT.width / 2}
            cy={FOOTPRINT.height / 2}
            rx={FOOTPRINT.width / 2 - 1}
            ry={FOOTPRINT.height / 2 - 1}
            fill={colors.blue}
            fillOpacity={0.08}
            stroke={colors.blue}
            strokeOpacity={0.7}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        </Svg>
      </Animated.View>
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
  // 퍼센트는 정수로 둡니다 — "95.83333333333334%" 같은 긴 소수는 안드로이드에서 transformOrigin 파싱에 실패해 핀이 그려지지 않았습니다.
  pin: { width: PIN.width, height: PIN.height, transformOrigin: `50% ${Math.round((PIN.tipY / PIN.height) * 100)}%` },
  labelBox: { width: LABEL_BOX, height: PIN.labelHeight, alignItems: "flex-start", transformOrigin: "0% 50%" },
  // 피그마 Selected destination: white, r10, 그림자 2 5 10, Caption darkgreen
  label: {
    height: PIN.labelHeight,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.white,
    justifyContent: "center",
    ...shadows.label,
  },
  veil: { position: "absolute", left: 0, right: 0, top: 0 },
  veilSolid: { backgroundColor: colors.white },
  veilFade: { height: VEIL_FADE },
});
