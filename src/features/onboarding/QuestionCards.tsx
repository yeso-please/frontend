import { forwardRef, useEffect } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import type { MbtiQuestion, TravelStyleQuestion } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { colors, motion, radius, space } from "@/theme";

import { PreferenceSlider } from "./PreferenceSlider";
import { styleCopy } from "./survey";
import { SurveyCard, type CardState, type SurveyCardHandle } from "./SurveyCard";

type CardBase = { state: CardState; order: number; total: number; onLayout: (e: LayoutChangeEvent) => void; enterDelay?: number };

/** 피그마 초안 Survey question (342×312) — 진행("새로운 장소 · 2/4"), 질문, 양 끝 라벨, 5단 슬라이더, 중립 안내 */
export const StyleQuestionCard = forwardRef<
  SurveyCardHandle,
  CardBase & { question: TravelStyleQuestion; value: number | undefined; onChange: (v: number) => void; onRelease: () => void }
>(function StyleQuestionCard({ state, order, total, onLayout, enterDelay, question, value, onChange, onRelease }, ref) {
  const copy = styleCopy(question);
  return (
    <SurveyCard ref={ref} state={state} onLayout={onLayout} enterDelay={enterDelay}>
      <View style={styles.head}>
        <AppText variant="caption" color="blue">
          {`${copy.kicker} · ${order}/${total}`}
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          {copy.question}
        </AppText>
      </View>
      <PreferenceSlider leftPole={question.leftPole} rightPole={question.rightPole} value={value} onChange={onChange} onRelease={onRelease} />
      <AppText variant="small12" color="muted">
        가운데는 두 취향 사이의 균형이에요.
      </AppText>
    </SurveyCard>
  );
});

/** 여행 MBTI 한 문항 — 같은 카드 모양에 두 선택지 줄. 선택 순서(1·2)대로 보냅니다 */
export const MbtiQuestionCard = forwardRef<SurveyCardHandle, CardBase & { question: MbtiQuestion; value: 1 | 2 | undefined; onChange: (v: 1 | 2) => void }>(
  function MbtiQuestionCard({ state, order, total, onLayout, question, value, onChange }, ref) {
    return (
      <SurveyCard ref={ref} state={state} onLayout={onLayout}>
        <View style={styles.head}>
          <AppText variant="caption" color="blue">
            {`여행 MBTI · ${order}/${total}`}
          </AppText>
          <AppText variant="cardTitle" accessibilityRole="header">
            {question.question}
          </AppText>
        </View>
        <View style={styles.choices} accessibilityRole="radiogroup">
          {question.choices.map((c, i) => (
            <ChoiceRow key={c.choice} letter={i === 0 ? "A" : "B"} label={c.label} selected={value === c.choice} onPress={() => onChange(c.choice)} />
          ))}
        </View>
      </SurveyCard>
    );
  },
);

/** 선택지 줄 — 선택 시 paleblue 배경 + 2px blue 테두리가 페이드인되고 체크가 튀어나옵니다 (레이아웃 이동 없음) */
function ChoiceRow({ letter, label, selected, onPress }: { letter: string; label: string; selected: boolean; onPress: () => void }) {
  const on = useSharedValue(selected ? 1 : 0);
  const pop = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, motion.timing.fast));
    pop.set(selected ? withSpring(1, motion.spring.bouncy) : withTiming(0, motion.timing.fast));
  }, [selected, on, pop]);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: on.get() }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.get()), transform: [{ scale: pop.get() }] }));

  return (
    <PressableScale
      onPress={onPress}
      haptic="tick"
      scaleTo={0.98}
      style={styles.choice}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${letter}. ${label}`}
    >
      <Animated.View pointerEvents="none" style={[styles.choiceOverlay, overlayStyle]} />
      <AppText variant="caption" color={selected ? "blue" : "muted"} style={styles.letter}>
        {letter}
      </AppText>
      <AppText variant="bodyMedium15" style={styles.choiceText}>
        {label}
      </AppText>
      <View style={styles.checkSlot}>
        <Animated.View style={checkStyle}>
          <Icons.CheckSelected width={20} height={20} />
        </Animated.View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  head: { gap: space[12] },
  choices: { gap: space[8] },
  choice: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
  },
  // 1px 기본 테두리 위를 덮도록 바깥으로 1px 넓힙니다
  choiceOverlay: {
    position: "absolute",
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.blue,
    backgroundColor: colors.paleblue,
  },
  letter: { width: 14 },
  choiceText: { flex: 1 },
  checkSlot: { width: 20, height: 20 },
});
