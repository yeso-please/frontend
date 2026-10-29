import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { MAP_IMAGE } from "@/lib/mapProjection";
import { colors, radius, shadows } from "@/theme";

import { type MapWave, pieceLift } from "../hooks/useMapWave";
import { PIN_MODE, type PinValues } from "../hooks/usePinChoreography";
import { MAP_PIECES, type RegionShape } from "../lib/koreaMap.generated";
import { type DiscoverGeometry, mapTransform, PIN, projectOnScreen } from "../lib/geometry";

const KOREA_TERRAIN = require("@/assets/illustrations/korea-terrain.webp");

// 피그마 B3: Selected area glow 84×46 (핀 끝보다 1 오른쪽·9 아래가 중심)
const GLOW = { width: 84, height: 46, dx: 1, dy: 9 } as const;
/** 라벨 상자 폭 (말풍선은 그 안에서 왼쪽 정렬) */
const LABEL_BOX = 200;
/** 인트로 뒤 가림막 아래쪽 그라데이션 높이 */
const VEIL_FADE = 28;
/** 들린 조각 아래로 보이는 옆면(땅 두께) 색 */
const PIECE_SIDE = "#2F4B2C";
/** 손에 든 핀은 가까이 있어 크게, 날아가며 원래 크기로 */
const HELD_SCALE = 1.75;
/** 던진 핀이 그리는 포물선 높이 (모은 힘만큼 더 높이) */
const ARC = 150;
const ARC_EXTRA = 70;
/** 선택 지역 외곽선 두께 (B3 확대 화면 기준 dp): 흰 바탕 선 위에 초록 선 */
const OUTLINE_UNDER = 4.6;
const OUTLINE_LINE = 2.4;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** 지도·핀이 함께 읽는 화면 상태 */
export type MapStage = {
  /** 0 = B1 기본 지도, 1 = B2 핀 모드, 2 = B3 지역 확대 */
  zoom: SharedValue<number>;
  /** B3에서 확대해 보여 줄 지역 (지도 0~1 좌표) */
  focusU: SharedValue<number>;
  focusV: SharedValue<number>;
};

/** 뽑힌 지역 외곽선 (id: sigCd · draw: 선이 그려지는 정도 0~1) */
export type MapOutline = { id: string; shape: RegionShape; draw: SharedValue<number> } | null;

/** 도 조각 하나: 제자리의 어두운 옆면 + 파도에 따라 들리는 윗면 (경계선은 조각 그림에 구워져 있음) */
const MapPiece = memo(function MapPiece({ index, scale, wave }: { index: number; scale: number; wave: MapWave }) {
  const piece = MAP_PIECES[index];
  const topStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -pieceLift(wave, index) }] }));
  // 조각이 들리면 비는 자리(제자리 실루엣 중 윗면에 가리지 않은 띠)가 옆면처럼 보입니다.
  const sideStyle = useAnimatedStyle(() => ({ opacity: Math.min(0.85, Math.max(0, pieceLift(wave, index)) / 2.5) }));
  const box = { left: piece.x * scale, top: piece.y * scale, width: piece.w * scale, height: piece.h * scale };
  return (
    <View style={[styles.piece, box]}>
      <Animated.View style={[StyleSheet.absoluteFill, sideStyle]}>
        <Image source={piece.source} style={StyleSheet.absoluteFill} tintColor={PIECE_SIDE} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, topStyle]}>
        <Image source={piece.source} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
});

/**
 * 뽑힌 시군구 외곽선. B3 확대 배율(k2)로 그린 뒤 줄여 두어 확대해도 선이 흐려지지 않습니다.
 * 선은 한 바퀴 그려지듯 나타나고(dash), 안쪽은 옅은 초록으로 채워집니다.
 */
function RegionOutline({ outline, scale, k, wave }: { outline: NonNullable<MapOutline>; scale: number; k: number; wave: MapWave }) {
  const { shape, draw } = outline;
  const [bx, by, bw, bh] = shape.box;
  const unit = scale * k; // viewBox 1 = B3에서 unit dp
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -pieceLift(wave, shape.piece) }] }));
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: shape.len * (1 - draw.value) }));
  const fillProps = useAnimatedProps(() => ({ fillOpacity: 0.2 * interpolate(draw.value, [0.4, 1], [0, 1], Extrapolation.CLAMP) }));
  const extraProps = useAnimatedProps(() => ({ strokeOpacity: interpolate(draw.value, [0.5, 1], [0, 1], Extrapolation.CLAMP) }));
  const dash = [shape.len, shape.len];
  return (
    <Animated.View pointerEvents="none" style={[styles.outline, { left: bx * scale, top: by * scale }, liftStyle]}>
      <View style={{ width: bw * unit, height: bh * unit, transform: [{ scale: 1 / k }], transformOrigin: "0% 0%" }}>
        <Svg width={bw * unit} height={bh * unit} viewBox={`${bx} ${by} ${bw} ${bh}`}>
          <AnimatedPath d={shape.d + shape.extra} fill={colors.green} animatedProps={fillProps} />
          <AnimatedPath
            d={shape.d}
            fill="none"
            stroke={colors.white}
            strokeWidth={OUTLINE_UNDER / unit}
            strokeLinejoin="round"
            strokeDasharray={dash}
            animatedProps={lineProps}
          />
          <AnimatedPath
            d={shape.d}
            fill="none"
            stroke={colors.green}
            strokeWidth={OUTLINE_LINE / unit}
            strokeLinejoin="round"
            strokeDasharray={dash}
            animatedProps={lineProps}
          />
          {shape.extra ? (
            <AnimatedPath d={shape.extra} fill="none" stroke={colors.green} strokeWidth={OUTLINE_LINE / unit} strokeLinejoin="round" animatedProps={extraProps} />
          ) : null}
        </Svg>
      </View>
    </Animated.View>
  );
}

/**
 * 3D 지형 지도. 그림 위에 도 단위 조각 17장을 겹쳐 두고(경계선 포함) 파도·충격에 따라 조각을 들썩입니다.
 * 크기 변화는 width/height가 아니라 transform(scale·translate)으로만 움직입니다.
 */
export function MapLayer({
  geo,
  stage,
  wave,
  outline,
  accessibilityLabel,
}: {
  geo: DiscoverGeometry;
  stage: MapStage;
  wave: MapWave;
  outline: MapOutline;
  accessibilityLabel: string;
}) {
  const { zoom, focusU, focusV } = stage;
  const animatedStyle = useAnimatedStyle(() => {
    const t = mapTransform(geo, zoom.value, focusU.value, focusV.value);
    return { transform: [{ translateX: t.tx }, { translateY: t.ty }, { scale: t.k }] };
  });
  // 그림 1px = scale dp (기본 지도 배율)
  const scale = geo.w / MAP_IMAGE.width;

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[{ position: "absolute", left: geo.cx - geo.w / 2, top: geo.cy - geo.h / 2, width: geo.w, height: geo.h }, animatedStyle]}
    >
      <Image source={KOREA_TERRAIN} style={StyleSheet.absoluteFill} contentFit="contain" priority="high" />
      {MAP_PIECES.map((p, i) => (
        <MapPiece key={p.sido} index={i} scale={scale} wave={wave} />
      ))}
      {outline ? <RegionOutline key={outline.id} outline={outline} scale={scale} k={geo.k2} wave={wave} /> : null}
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

/**
 * 핀·바닥 그림자·글로우·지역 라벨. 지도와 같은 변환을 따라 화면 좌표에 그립니다.
 * 손에 든 핀은 버튼 위에서 떨리고, 던지면 손 → 지도로 포물선을 그리며 끝이 앞서도록 돌아갑니다.
 */
export function PinLayer({
  geo,
  stage,
  pin,
  wave,
  label,
}: {
  geo: DiscoverGeometry;
  stage: MapStage;
  pin: PinValues;
  wave: MapWave;
  label: string | null;
}) {
  const { zoom, focusU, focusV } = stage;

  // 핀 끝(지면에 닿는 점)의 화면 좌표. 핀이 꽂힌 조각이 들썩이면 같이 움직입니다.
  const tip = useDerivedValue(() => {
    const t = mapTransform(geo, zoom.value, focusU.value, focusV.value);
    const p = projectOnScreen(geo, t, pin.u.value, pin.v.value);
    const piece = wave.impactPiece.value;
    return piece >= 0 ? { x: p.x, y: p.y - pieceLift(wave, piece) * t.k } : p;
  });
  const pinScale = useDerivedValue(() => interpolate(zoom.value, [1, 2], [1, PIN.foundScale], Extrapolation.CLAMP));

  // 지금 핀의 화면 위치·배율·회전 (모드별)
  const pose = useDerivedValue(() => {
    const p = tip.value;
    const mode = pin.mode.value;
    if (mode === PIN_MODE.held) {
      // 힘을 모을수록 빠르고 크게 떨림
      const shake = pin.power.value;
      const t = wave.phase.value * Math.PI * 2;
      return {
        x: pin.holdX.value + Math.sin(t * 9) * 2.2 * shake,
        y: pin.holdY.value + Math.cos(t * 7) * 1.6 * shake - 6 * shake,
        k: HELD_SCALE * (1 + 0.06 * shake),
        rot: -14 + Math.sin(t * 5) * 5 * shake,
      };
    }
    if (mode === PIN_MODE.flying) {
      const f = pin.fly.value;
      const ex = p.x;
      const ey = p.y + pin.lift.value;
      const arc = ARC + ARC_EXTRA * pin.power.value;
      const x = pin.holdX.value + (ex - pin.holdX.value) * f;
      const y = pin.holdY.value + (ey - pin.holdY.value) * f - arc * 4 * f * (1 - f);
      // 진행 방향(접선)으로 핀 끝이 앞서게 — 아래(+y)가 0°. 착지 직전에는 똑바로 섭니다.
      const dx = ex - pin.holdX.value;
      const dy = ey - pin.holdY.value - arc * 4 * (1 - 2 * f);
      const heading = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
      const upright = interpolate(f, [0.8, 1], [1, 0], Extrapolation.CLAMP);
      return { x, y, k: HELD_SCALE + (pinScale.value - HELD_SCALE) * f, rot: heading * upright };
    }
    return { x: p.x, y: p.y + pin.lift.value, k: pinScale.value, rot: 0 };
  });

  const groundStyle = useAnimatedStyle(() => {
    const p = tip.value;
    const mode = pin.mode.value;
    // 날아오는 동안에는 떨어질 자리에서 점점 진해집니다.
    const near = mode === PIN_MODE.flying ? pin.fly.value ** 2 : mode === PIN_MODE.held ? 0 : interpolate(pin.lift.value, [-150, 0], [0.3, 1], Extrapolation.CLAMP);
    return {
      opacity: pin.opacity.value * 0.28 * near,
      transform: [{ translateX: p.x - 11 }, { translateY: p.y - 3 }, { scale: (0.4 + 0.6 * near) * pinScale.value }],
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

  const pinStyle = useAnimatedStyle(() => {
    const s = pose.value;
    const squash = pin.squash.value;
    return {
      opacity: pin.opacity.value,
      transform: [
        { translateX: s.x - PIN.width / 2 },
        { translateY: s.y - PIN.tipY },
        { rotate: `${s.rot}deg` },
        // 끝점 기준으로 키우고, 눌릴 때 옆으로 퍼져 부피가 유지되는 느낌
        { scaleX: s.k * (1 + (1 - squash) * 0.6) },
        { scaleY: s.k * squash },
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
      <Animated.View style={[styles.ground, groundStyle]} />
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
  piece: { position: "absolute" },
  outline: { position: "absolute" },
  ground: { position: "absolute", left: 0, top: 0, width: 22, height: 7, borderRadius: radius.pill, backgroundColor: colors.charcoal },
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
