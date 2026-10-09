import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { colors, radius, screenPadding, space } from "@/theme";

import { AnswerCard } from "./AnswerCard";
import type { MbtiAxis, MbtiQuestion } from "./questions";

type Props = {
  question: MbtiQuestion;
  answer: 0 | 1 | null;
  onAnswer: (choice: 0 | 1) => void;
};

// 피그마에는 S1 모티프 아이콘(캘린더)만 있어 축별로 있는 blue 아이콘을 나눠 씁니다. TODO(디자인): 질문별 모티프 아이콘
const MOTIF: Record<MbtiAxis, () => ReactNode> = {
  JP: () => <Icons.CalendarSurvey width={24} height={24} />,
  SN: () => <Icons.PinBlue20 width={22} height={22} />,
  TF: () => <Icons.Spark width={22} height={22} />,
  EI: () => <Icons.Spark width={22} height={22} />,
};

/** "여행을 떠날 때 계획은" → "여행을 떠날 때\n계획은?" — 피그마처럼 두 줄로 고르게 나눕니다 (긴 문장은 자연 줄바꿈) */
function questionTitle(text: string) {
  const title = `${text}?`;
  if (title.length < 10 || title.length > 22) return title;
  const mid = title.length / 2;
  let best = -1;
  for (let i = 0; i < title.length; i++) {
    if (title[i] === " " && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return best === -1 ? title : `${title.slice(0, best)}\n${title.slice(best + 1)}`;
}

/** 피그마 S1 · 여행 취향 질문 (400:1438) — 질문 1개 + A/B 답변 카드, 자동 진행 없음 */
export function QuestionStep({ question, answer, onAnswer }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heading}>
        <View style={styles.motif}>{MOTIF[question.axis]()}</View>
        <AppText variant="caption" color="blue">
          여행 취향 알아보기
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          {questionTitle(question.text)}
        </AppText>
        <AppText variant="body" color="muted">
          나와 더 가까운 답을 하나 골라주세요.
        </AppText>
      </View>

      <View style={styles.answers} accessibilityRole="radiogroup">
        <AnswerCard letter="A" text={question.choices[0].text} selected={answer === 0} onPress={() => onAnswer(0)} />
        <AnswerCard letter="B" text={question.choices[1].text} selected={answer === 1} onPress={() => onAnswer(1)} />
      </View>

      <AppText variant="caption" color="muted">
        정답은 없어요. 평소의 나를 떠올려보세요.
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[32], paddingBottom: space[24], gap: space[24] },
  heading: { gap: space[12] },
  motif: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.paleblue, alignItems: "center", justifyContent: "center" },
  answers: { gap: space[12] },
});
