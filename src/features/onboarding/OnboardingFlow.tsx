import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { toast } from "sonner-native";

import { onboardingApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { MyOnboarding, OnboardingQuestions, OnboardingSubmission } from "@/api/types";
import { AppText, BottomCTA, Button, EmptyView, ErrorView, LoadingView, ProgressBar, Screen, TopBar } from "@/components/ui";
import { isMbtiType, PersonaResult } from "@/features/mbti";
import { haptics } from "@/lib/haptics";
import { useAuthStore } from "@/store/auth";
import { colors, motion, screenPadding, space } from "@/theme";

import { AnalysisView } from "./AnalysisView";
import { MotiveSection } from "./MotiveSection";
import { MbtiQuestionCard, StyleQuestionCard } from "./QuestionCards";
import { answeredCount, buildSteps, buildSubmission, emptyAnswers, firstUnanswered, isStepAnswered, type SurveyAnswers, type SurveyStep } from "./survey";
import type { CardState, SurveyCardHandle } from "./SurveyCard";

export type OnboardingMode = "first" | "retake";

/** 분석 화면을 최소 이만큼은 보여 줍니다 (응답이 빨라도 깜빡이지 않게) */
const MIN_ANALYSIS_MS = 1400;
/** 답을 고른 뒤 다음 카드로 넘어가기 전 잠깐 (고른 모습을 보여 주려고) */
const ADVANCE_DELAY_MS = 260;
/** 카드를 화면 맨 위에서 이만큼 띄워 맞춥니다 */
const SCROLL_TOP_GAP = 16;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 취향 설문(aihub-traveler-v2) — 피그마 초안 C1a 한 페이지 세로 스크롤:
 * 여행 성향 4문항(5단 슬라이더) → 여행 MBTI 12문항 → 여행 동기 → "내 여행 성향 보기" → 분석 → C6 결과.
 * 지금 답할 카드만 강조하고, 답하면 다음 카드로 부드럽게 내려갑니다. 일정 밀도는 묻지 않습니다(서버가 J/P로 정함).
 * - first: 가입 직후. 결과의 "코스 만들기"에서 onboardingCompleted를 켜면 루트 가드가 탭으로 바꾸고 여행 탭으로 갑니다.
 * - retake: 홈·MY → 성향검사 다시하기 (/survey). 새 제출이 최신 취향이 됩니다.
 */
export function OnboardingFlow({ mode }: { mode: OnboardingMode }) {
  const questionsQuery = useQuery({ queryKey: queryKeys.onboardingQuestions, queryFn: onboardingApi.questions });
  // 문항 버전이 바뀌어 처음부터 다시 할 때 화면을 새로 마운트합니다
  const [session, setSession] = useState(0);
  const questions = questionsQuery.data;

  if (!questions) {
    return (
      <Screen>
        <TopBar title="취향 설문" showBack={mode === "retake"} />
        {questionsQuery.isError ? (
          <ErrorView error={questionsQuery.error} onRetry={() => questionsQuery.refetch()} />
        ) : (
          <LoadingView label="설문을 준비하고 있어요" />
        )}
      </Screen>
    );
  }

  return (
    <SurveyPage
      key={`${questions.questionVersion}:${session}`}
      mode={mode}
      questions={questions}
      onRestart={async () => {
        await questionsQuery.refetch();
        setSession((s) => s + 1);
      }}
    />
  );
}

type Phase = "survey" | "analyzing" | "result";

function SurveyPage({ mode, questions, onRestart }: { mode: OnboardingMode; questions: OnboardingQuestions; onRestart: () => void }) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("survey");
  const [answers, setAnswers] = useState<SurveyAnswers>(emptyAnswers);
  const [result, setResult] = useState<OnboardingSubmission | null>(null);
  const steps = useMemo(() => buildSteps(questions), [questions]);

  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const cardRefs = useRef<Record<string, SurveyCardHandle | null>>({});
  const answersRef = useRef(answers);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  // Android 뒤로가기: 분석 중에는 막고, 첫 설문 결과에서는 설문으로 돌아가지 않습니다(이미 저장됨)
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => phase === "analyzing" || (phase === "result" && mode === "first"));
    return () => sub.remove();
  }, [phase, mode]);

  const next = firstUnanswered(steps, answers);
  const complete = next === null;
  const activeIndex = next ? steps.indexOf(next) : -1;
  const stateOf = (step: SurveyStep, index: number): CardState =>
    index === activeIndex ? "active" : isStepAnswered(step, answers) ? "answered" : "upcoming";

  const scrollTo = (key: string) => {
    const y = offsets.current[key];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - SCROLL_TOP_GAP), animated: true });
  };

  /** 방금 답한 문항 다음에 남은 문항이 있으면 그 카드로 내려갑니다 (앞쪽 빈 문항으로 되돌아 올라가지는 않음) */
  const advanceFrom = (key: string) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      const from = steps.findIndex((s) => s.key === key);
      const target = steps.find((s, i) => i > from && !isStepAnswered(s, answersRef.current));
      if (target) scrollTo(target.key);
    }, ADVANCE_DELAY_MS);
  };

  const setStyle = (number: number, value: number) => setAnswers((a) => ({ ...a, styles: { ...a.styles, [String(number)]: value } }));
  const setMbti = (step: SurveyStep, number: number, choice: 1 | 2) => {
    setAnswers((a) => ({ ...a, mbti: { ...a.mbti, [String(number)]: choice } }));
    advanceFrom(step.key);
  };

  const onCta = () => {
    if (!next) {
      void submit();
      return;
    }
    // 아직 답하지 않은 첫 카드로 데려가 살짝 흔듭니다
    haptics.reject();
    scrollTo(next.key);
    setTimeout(() => cardRefs.current[next.key]?.shake(), 320);
  };

  const submit = async () => {
    setPhase("analyzing");
    const minDelay = wait(MIN_ANALYSIS_MS);
    try {
      const res = await onboardingApi.submit(buildSubmission(questions, answers));
      await minDelay;
      haptics.confirm();
      queryClient.setQueryData<MyOnboarding>(queryKeys.myOnboarding, { onboardingCompleted: true, submission: res });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      // 성향이 바뀌면 지역 맞춤 문장(7-6)도 달라집니다
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "regions" && q.queryKey[2] === "match" });
      setResult(res);
      setPhase("result");
    } catch (e) {
      await minDelay;
      if (isApiError(e, "ONBOARDING_INVALID_QUESTION_VERSION")) {
        toast("설문 문항이 새로 바뀌었어요. 처음부터 다시 골라주세요.");
        onRestart();
        return;
      }
      haptics.reject();
      toast.error(errorMessage(e));
      setPhase("survey");
    }
  };

  const retake = () => {
    setAnswers(emptyAnswers());
    setResult(null);
    setPhase("survey");
  };

  const makeCourse = () => {
    if (mode === "first") {
      // 루트 가드(Stack.Protected)가 onboardingCompleted를 보고 탭으로 바꾼 뒤 여행 탭으로 갑니다
      useAuthStore.getState().setOnboardingCompleted(true);
      setTimeout(() => router.navigate("/(tabs)/travel"), 60);
      return;
    }
    router.navigate("/(tabs)/travel");
  };

  if (phase === "result" && result) {
    return (
      <Screen>
        <TopBar title="나의 여행 성향" showBack={mode === "retake"} />
        <Animated.View entering={FadeIn.duration(260)} style={styles.flex}>
          {isMbtiType(result.mbtiCode) ? (
            <PersonaResult type={result.mbtiCode} onMakeCourse={makeCourse} onRetake={retake} />
          ) : (
            // MBTI 없는 예전 문항(v1)으로 답한 경우 — 성향 대신 취향 요약만
            <EmptyView title="여행 취향을 저장했어요" description={result.profileText || undefined} actionLabel="여행지 찾으러 가기" onAction={makeCourse} />
          )}
        </Animated.View>
      </Screen>
    );
  }

  const progress = answeredCount(steps, answers) / steps.length;

  return (
    <Screen>
      <TopBar title="취향 설문" showBack={mode === "retake" && phase === "survey"} />
      <View style={styles.progress}>
        <ProgressBar progress={phase === "analyzing" ? 1 : progress} color={phase === "analyzing" ? colors.green : colors.blue} height={3} />
      </View>

      {phase === "analyzing" ? (
        <Animated.View key="analyzing" entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={styles.flex}>
          <AnalysisView title={"나의 여행 성향을\n찾고 있어요"} description={"고른 답을 모아,\n나에게 맞는 여행 방식을 정리하는 중이에요."} />
        </Animated.View>
      ) : (
        <>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInDown.springify().damping(motion.spring.gentle.damping)} style={styles.intro}>
              <AppText variant="title" accessibilityRole="header">
                {"어떤 여행이\n나와 잘 맞을까요?"}
              </AppText>
              <AppText variant="small13" color="muted">
                {"정답은 없어요. 더 끌리는 쪽을 골라주세요.\n답할수록 나의 여행 성향이 또렷해져요."}
              </AppText>
            </Animated.View>

            {steps.map((step, i) => {
              const onLayout = (e: LayoutChangeEvent) => {
                offsets.current[step.key] = e.nativeEvent.layout.y;
              };
              const ref = (r: SurveyCardHandle | null) => {
                cardRefs.current[step.key] = r;
              };
              if (step.kind === "style") {
                return (
                  <StyleQuestionCard
                    key={step.key}
                    ref={ref}
                    state={stateOf(step, i)}
                    order={step.order}
                    total={step.total}
                    onLayout={onLayout}
                    question={step.question}
                    value={answers.styles[String(step.question.number)]}
                    onChange={(v) => setStyle(step.question.number, v)}
                    onRelease={() => advanceFrom(step.key)}
                    enterDelay={motion.stagger * (i + 1)}
                  />
                );
              }
              if (step.kind === "mbti") {
                // 카드는 스크롤 내용의 바로 아래 자식이어야 onLayout y가 스크롤 위치와 맞습니다 (그래서 묶음 View 없이 Fragment)
                return (
                  <Fragment key={step.key}>
                    {step.order === 1 ? (
                      <View style={styles.sectionIntro}>
                        <AppText variant="cardTitle" accessibilityRole="header">
                          조금 더 알아볼게요
                        </AppText>
                        <AppText variant="small13" color="muted">
                          {`여행할 때 나와 더 가까운 쪽을 골라주세요. ${step.total}개의 질문으로 나의 여행 성향을 찾아요.`}
                        </AppText>
                      </View>
                    ) : null}
                    <MbtiQuestionCard
                      ref={ref}
                      state={stateOf(step, i)}
                      order={step.order}
                      total={step.total}
                      onLayout={onLayout}
                      question={step.question}
                      value={answers.mbti[String(step.question.number)]}
                      onChange={(c) => setMbti(step, step.question.number, c)}
                    />
                  </Fragment>
                );
              }
              return (
                <MotiveSection
                  key={step.key}
                  ref={ref}
                  state={stateOf(step, i)}
                  motives={questions.travelMotives}
                  max={questions.maxTravelMotives}
                  selected={answers.motives}
                  onChange={(codes) => setAnswers((a) => ({ ...a, motives: codes }))}
                  onLayout={onLayout}
                />
              );
            })}
          </ScrollView>
          <BottomCTA>
            <Button
              label="내 여행 성향 보기"
              variant={complete ? "primary" : "neutral"}
              labelColor={complete ? undefined : "muted"}
              onPress={onCta}
              accessibilityHint={complete ? "답을 보내고 나의 여행 성향을 확인해요" : "아직 답하지 않은 질문으로 이동해요"}
            />
          </BottomCTA>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progress: { paddingHorizontal: screenPadding, paddingBottom: space[8] },
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[32], gap: space[16] },
  intro: { gap: space[8], marginBottom: space[8] },
  sectionIntro: { gap: space[8], marginTop: space[16] },
});
