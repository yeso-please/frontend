import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown, type SharedValue, ZoomIn, ZoomOut } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { Button, PressableScale } from "@/components/ui";
import { colors, motion, radius, screenPadding, space } from "@/theme";

import { HoldToThrowButton } from "./HoldToThrowButton";

type Props = {
  top: number;
  visible: boolean;
  /** 조건 뽑기(내 취향)를 켰는지 */
  conditional: boolean;
  /** 핀 꽂기를 꾹 누르고 있는지 · 모은 힘 0~1 */
  holding: boolean;
  power: SharedValue<number>;
  onHoldStart: () => void;
  onRelease: () => void;
  onShortPress: () => void;
  onManual: () => void;
  onConditions: () => void;
};

/** 조건 버튼 아이콘 (슬라이더 두 줄) — darkgreen 1.6 선 */
function SlidersIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path d="M4 7h14M4 15h14" stroke={colors.darkgreen} strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx={8} cy={7} r={2.4} fill={colors.mint} stroke={colors.darkgreen} strokeWidth={1.6} />
      <Circle cx={14} cy={15} r={2.4} fill={colors.mint} stroke={colors.darkgreen} strokeWidth={1.6} />
    </Svg>
  );
}

/**
 * B1 버튼 (피그마 Home actions 24,652: 핀 꽂기 46 + 4 + 직접 지역 선택하기 44).
 * 핀 꽂기는 꾹 눌렀다가 떼면 핀이 날아갑니다 (지도에 다트를 던지는 랜덤 여행 영상에서 착안).
 * 핀 꽂기 오른쪽의 작은 조건 버튼은 숨김 레이어 Region conditions를 여는 자리입니다.
 * B2·B3에서는 아래로 사라집니다 (피그마 B2는 버튼을 화면 밖 y870에 둡니다).
 */
export function DiscoverActions({ top, visible, conditional, holding, power, onHoldStart, onRelease, onShortPress, onManual, onConditions }: Props) {
  return (
    <View style={[styles.slot, { top }]} pointerEvents="box-none">
      {visible ? (
        <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOutDown.duration(200)} style={styles.layer}>
          <View style={styles.row}>
            <HoldToThrowButton
              label={conditional ? "내 취향으로 핀 꽂기" : "핀 꽂기"}
              holdingLabel="놓으면 핀이 날아가요"
              holding={holding}
              power={power}
              onHoldStart={onHoldStart}
              onRelease={onRelease}
              onShortPress={onShortPress}
              style={styles.flex}
              accessibilityHint={conditional ? "꾹 눌렀다가 놓으면 내 취향과 닮은 지역으로 핀이 날아가요" : "꾹 눌렀다가 놓으면 핀이 날아가 여행지가 무작위로 정해져요"}
            />
            <PressableScale
              onPress={onConditions}
              haptic="tick"
              style={[styles.conditions, conditional && styles.conditionsOn]}
              accessibilityRole="button"
              accessibilityLabel="뽑기 조건"
              accessibilityState={{ selected: conditional }}
              accessibilityHint="내 취향 조건을 켜거나 끌 수 있어요"
            >
              <SlidersIcon />
              {conditional ? (
                <Animated.View entering={ZoomIn.springify().damping(motion.spring.bouncy.damping)} exiting={ZoomOut.duration(120)} style={styles.dot} />
              ) : null}
            </PressableScale>
          </View>
          <Button label="직접 지역 선택하기" variant="secondary" height={44} onPress={onManual} accessibilityHint="지역 목록에서 직접 골라요" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 피그마 Home actions (24, 652, 342×94)
  slot: { position: "absolute", left: screenPadding, right: screenPadding, height: 94 },
  layer: { position: "absolute", left: 0, right: 0, top: 0, gap: space[4] },
  row: { flexDirection: "row", gap: space[8] },
  flex: { flex: 1 },
  conditions: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  conditionsOn: { borderWidth: 1.5, borderColor: colors.green },
  dot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    borderWidth: 1.5,
    borderColor: colors.mint,
  },
});
