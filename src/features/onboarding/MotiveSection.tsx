import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import type { TravelMotive } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { colors, motion, radius, space } from "@/theme";

import { motiveLabel, toggleMotive } from "./survey";
import type { CardState, SurveyCardHandle } from "./SurveyCard";

type Props = {
  state: CardState;
  motives: TravelMotive[];
  max: number;
  selected: number[];
  onChange: (codes: number[]) => void;
  onLayout: (e: LayoutChangeEvent) => void;
};

/**
 * 피그마 확정 C5 · 여행 동기 (초안 C1a 페이지 맨 아래). 서버 순서 그대로, 최대 max개.
 * 넘기면 누른 줄이 흔들리고 안내 문구가 잠깐 나옵니다. 코드 5는 "사진 남기기"로 보여 줍니다.
 */
export const MotiveSection = forwardRef<SurveyCardHandle, Props>(function MotiveSection({ state, motives, max, selected, onChange, onLayout }, ref) {
  const rowRefs = useRef<Record<number, RowHandle | null>>({});
  const [limitHit, setLimitHit] = useState(false);
  const opacity = useSharedValue(state === "upcoming" ? 0.45 : 1);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    opacity.set(withTiming(state === "upcoming" ? 0.45 : 1, motion.timing.base));
  }, [state, opacity]);

  useEffect(() => {
    if (!limitHit) return;
    const timer = setTimeout(() => setLimitHit(false), 2200);
    return () => clearTimeout(timer);
  }, [limitHit]);

  useImperativeHandle(ref, () => ({ shake: () => shakeX.set(shakeSequence()) }), [shakeX]);

  const toggle = (code: number) => {
    const { next, limited } = toggleMotive(selected, code, max);
    if (limited) {
      haptics.reject();
      rowRefs.current[code]?.shake();
      setLimitHit(true);
      return;
    }
    haptics.tick();
    onChange(next);
  };

  const sectionStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateX: shakeX.get() }] }));

  return (
    <Animated.View onLayout={onLayout} style={[styles.section, sectionStyle]}>
      <View style={styles.intro}>
        <AppText variant="cardTitle" accessibilityRole="header">
          이번 여행에서 가장 기대하는 건 뭐예요?
        </AppText>
        <AppText variant="small13" color="muted">
          {`마음이 가는 이유를 최대 ${max}개 골라주세요.`}
        </AppText>
      </View>
      <View style={styles.countRow}>
        <AppText variant="bold14" color="blue" accessibilityLiveRegion="polite">
          {`${selected.length} / ${max} 선택`}
        </AppText>
        {limitHit ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(200)}>
            <AppText variant="caption" color="blue" accessibilityLiveRegion="assertive">
              {`최대 ${max}개까지 고를 수 있어요`}
            </AppText>
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.list}>
        {motives.map((m) => (
          <MotiveRow
            key={m.code}
            ref={(r) => {
              rowRefs.current[m.code] = r;
            }}
            label={motiveLabel(m)}
            selected={selected.includes(m.code)}
            onPress={() => toggle(m.code)}
          />
        ))}
      </View>
    </Animated.View>
  );
});

type RowHandle = { shake: () => void };

const shakeSequence = () =>
  withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 60 }), withTiming(-5, { duration: 60 }), withSpring(0, motion.spring.snappy));

/** TriPin/Onboarding/Motive Row (342×44) — 선택 시 mint 배경·green 테두리·체크 */
const MotiveRow = forwardRef<RowHandle, { label: string; selected: boolean; onPress: () => void }>(function MotiveRow({ label, selected, onPress }, ref) {
  const on = useSharedValue(selected ? 1 : 0);
  const shakeX = useSharedValue(0);
  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, motion.timing.fast));
  }, [selected, on]);
  useImperativeHandle(ref, () => ({ shake: () => shakeX.set(shakeSequence()) }), [shakeX]);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [colors.white, colors.mint]),
    borderColor: interpolateColor(on.get(), [0, 1], [colors.border, colors.green]),
    transform: [{ translateX: shakeX.get() }],
  }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: on.get(), transform: [{ scale: 0.6 + 0.4 * on.get() }] }));

  return (
    <PressableScale onPress={onPress} haptic={false} scaleTo={0.98} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={label}>
      <Animated.View style={[styles.row, rowStyle]}>
        <AppText variant="body" color={selected ? "darkgreen" : "charcoal"} style={styles.rowText}>
          {label}
        </AppText>
        <Animated.View style={checkStyle}>
          <Icons.CheckFriend width={18} height={18} />
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  section: { gap: space[12] },
  intro: { gap: space[8] },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24 },
  list: { gap: space[8] },
  row: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space[16],
    flexDirection: "row",
    alignItems: "center",
    gap: space[8],
  },
  rowText: { flex: 1 },
});
