import { router } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { BottomCTA, Button, Screen } from "@/components/ui";
import { AnalysisView, useStepTransition } from "@/features/onboarding";
import { haptics } from "@/lib/haptics";
import { useMbtiStore } from "@/store/mbti";

import { computeMbti, MBTI_QUESTIONS } from "./questions";
import { QuestionStep } from "./QuestionStep";
import { SurveyTopBar } from "./SurveyTopBar";
import { TagStep } from "./TagStep";

type Phase = "questions" | "tags" | "analyzing";

const TOTAL = MBTI_QUESTIONS.length;
/** 피그마 Analysis state 설명: 1.2 s branded pin motion, then result */
const ANALYSIS_MS = 1200;

/**
 * 여행 MBTI 검사 — S1(12문항) → S2(경험 태그·제외 조건) → S3(분석) → B 결과(/my/mbti/result).
 * 결과는 앱 안에서만 계산해 useMbtiStore에 저장하고 서버에는 보내지 않습니다.
 */
export function MbtiSurveyFlow() {
  const setResult = useMbtiStore((s) => s.setResult);
  const { entering, exiting, go } = useStepTransition();

  const [phase, setPhase] = useState<Phase>("questions");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(0 | 1 | null)[]>(() => Array.from({ length: TOTAL }, () => null));
  const [preferences, setPreferences] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);

  const back = () => {
    if (phase === "analyzing") return;
    if (phase === "tags") {
      go(-1);
      setPhase("questions");
      return;
    }
    if (index > 0) {
      go(-1);
      setIndex(index - 1);
      return;
    }
    if (router.canGoBack()) router.back();
  };

  const next = () => {
    if (phase === "tags") {
      go(1);
      setPhase("analyzing");
      return;
    }
    if (answers[index] === null) return;
    go(1);
    if (index < TOTAL - 1) setIndex(index + 1);
    else setPhase("tags");
  };

  // Android 뒤로가기: 답을 유지한 채 이전 질문으로 (첫 질문이면 화면을 닫음)
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (phase === "analyzing") return true;
      if (phase === "tags" || index > 0) {
        go(-1);
        if (phase === "tags") setPhase("questions");
        else setIndex(index - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [phase, index, go]);

  // S3: 짧은 분석 연출 뒤 결과 저장 → B 결과로 교체
  useEffect(() => {
    if (phase !== "analyzing") return;
    const timer = setTimeout(() => {
      const type = computeMbti(answers.map((a) => a ?? 1));
      setResult({ type, preferenceTags: preferences, exclusionTags: exclusions, completedAt: new Date().toISOString() });
      haptics.confirm();
      router.replace("/my/mbti/result");
    }, ANALYSIS_MS);
    return () => clearTimeout(timer);
  }, [phase, answers, preferences, exclusions, setResult]);

  const counter = phase === "questions" ? `${index + 1} / ${TOTAL}` : phase === "tags" ? `${TOTAL} / ${TOTAL}` : "완료";
  const progress = phase === "questions" ? (index + 1) / TOTAL : 1;
  const contentKey = phase === "questions" ? `q-${index}` : phase;

  return (
    <Screen>
      <SurveyTopBar counter={counter} progress={progress} complete={phase === "analyzing"} onBack={back} showBack={phase !== "analyzing"} />

      <View style={styles.body}>
        <Animated.View key={contentKey} entering={entering} exiting={exiting} style={styles.page}>
          {phase === "questions" ? (
            <QuestionStep
              question={MBTI_QUESTIONS[index]}
              answer={answers[index]}
              onAnswer={(choice) => setAnswers((prev) => prev.map((a, i) => (i === index ? choice : a)))}
            />
          ) : null}
          {phase === "tags" ? <TagStep preferences={preferences} exclusions={exclusions} onPreferences={setPreferences} onExclusions={setExclusions} /> : null}
          {phase === "analyzing" ? <AnalysisView /> : null}
        </Animated.View>
      </View>

      {phase !== "analyzing" ? (
        <BottomCTA>
          <Button
            label={phase === "tags" ? "내 여행 성향 보기" : "다음"}
            disabled={phase === "questions" && answers[index] === null}
            onPress={next}
            accessibilityHint={phase === "questions" && answers[index] === null ? "답을 하나 골라주세요" : undefined}
          />
        </BottomCTA>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, overflow: "hidden" },
  page: { flex: 1 },
});
