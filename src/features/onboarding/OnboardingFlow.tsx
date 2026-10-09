import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, Keyboard, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { toast } from "sonner-native";

import { onboardingApi, regionApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { OnboardingQuestions, OnboardingSubmission, OnboardingSubmissionRequest, Region, ScheduleDensity } from "@/api/types";
import { Icons } from "@/components/icons";
import { BottomCTA, Button, ErrorView, LoadingView, Screen } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useAuthStore } from "@/store/auth";

import { AnalysisView } from "./AnalysisView";
import { DensityStep } from "./DensityStep";
import { MotiveStep } from "./MotiveStep";
import { OnboardingHeader } from "./OnboardingHeader";
import { OnboardingResult } from "./OnboardingResult";
import { RegionStep } from "./RegionStep";
import { StyleStep } from "./StyleStep";
import { useStepTransition, wait } from "./useStepTransition";

export type OnboardingMode = "first" | "retake";

const STEP_COUNT = 4;
/** 분석 화면을 최소 이만큼은 보여 줍니다 (응답이 빨라도 깜빡이지 않게) */
const MIN_ANALYSIS_MS = 1400;

type Answers = {
  styles: Record<string, number>;
  motives: number[];
  regions: Region[];
  density: ScheduleDensity | null;
  excluded: string[];
};

/**
 * AI Hub 온보딩 설문(aihub-traveler-v1).
 * - first: 가입 직후. 결과 화면의 "핀 꽂으러 가기"에서 onboardingCompleted를 켜면 루트 가드가 탭으로 바꿉니다.
 * - retake: MY → "여행 취향 다시 설정". 이전 답을 채워 두고, 끝나면 토스트 후 뒤로 갑니다.
 */
export function OnboardingFlow({ mode }: { mode: OnboardingMode }) {
  const retake = mode === "retake";
  const questionsQuery = useQuery({ queryKey: queryKeys.onboardingQuestions, queryFn: onboardingApi.questions });
  // 다시 설정할 때는 이전 답으로 미리 채웁니다 (실패하면 빈 설문으로 시작)
  const previousQuery = useQuery({ queryKey: queryKeys.myOnboarding, queryFn: onboardingApi.me, enabled: retake });
  const regionsQuery = useQuery({ queryKey: queryKeys.regions(), queryFn: () => regionApi.list(), enabled: retake });
  // 문항 버전이 바뀌어 처음부터 다시 할 때 폼을 새로 마운트합니다
  const [session, setSession] = useState(0);

  const restart = async () => {
    await questionsQuery.refetch();
    setSession((s) => s + 1);
  };

  const questions = questionsQuery.data;
  const loading = questionsQuery.isPending || (retake && (previousQuery.isLoading || regionsQuery.isLoading));

  if (!questions || loading) {
    return (
      <Screen>
        <OnboardingHeader showBack={retake} onBack={() => router.back()} step={null} total={STEP_COUNT} />
        {questionsQuery.isError && !questions ? (
          <ErrorView error={questionsQuery.error} onRetry={() => questionsQuery.refetch()} />
        ) : (
          <LoadingView label="설문을 준비하고 있어요" />
        )}
      </Screen>
    );
  }

  return (
    <OnboardingForm
      key={`${questions.questionVersion}:${session}`}
      mode={mode}
      questions={questions}
      initial={initialAnswers(questions, session === 0 ? previousQuery.data?.submission : null, regionsQuery.data?.regions)}
      onRestart={restart}
    />
  );
}

function initialAnswers(questions: OnboardingQuestions, previous: OnboardingSubmission | null | undefined, regionList: Region[] | undefined): Answers {
  const styles = Object.fromEntries(
    questions.travelStyles.map((q) => {
      const prev = previous?.travelStyles[String(q.number)];
      return [String(q.number), prev !== undefined && prev >= q.minValue && prev <= q.maxValue ? prev : q.neutralValue];
    }),
  );
  if (!previous) return { styles, motives: [], regions: [], density: null, excluded: [] };
  const codes = new Set(questions.travelMotives.map((m) => m.code));
  return {
    styles,
    motives: previous.travelMotives.filter((c) => codes.has(c)).slice(0, questions.maxTravelMotives),
    regions: previous.likedRegions
      .map((id) => regionList?.find((r) => r.sigCd === id))
      .filter((r): r is Region => !!r)
      .slice(0, questions.maxLikedRegions),
    density: questions.scheduleDensityOptions.includes(previous.scheduleDensity) ? previous.scheduleDensity : null,
    excluded: previous.excludeTags.filter((t) => questions.excludeTags.includes(t)),
  };
}

type Phase = "form" | "analyzing" | "result";

function OnboardingForm({ mode, questions, initial, onRestart }: { mode: OnboardingMode; questions: OnboardingQuestions; initial: Answers; onRestart: () => void }) {
  const queryClient = useQueryClient();
  const nickname = useAuthStore((s) => s.user?.nickname);
  const { entering, exiting, go } = useStepTransition();

  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>("form");
  const [styleValues, setStyleValues] = useState(initial.styles);
  const [motives, setMotives] = useState(initial.motives);
  const [regions, setRegions] = useState(initial.regions);
  const [density, setDensity] = useState(initial.density);
  const [excluded, setExcluded] = useState(initial.excluded);
  const [submission, setSubmission] = useState<OnboardingSubmission | null>(null);
  const submitMutation = useMutation({ mutationFn: onboardingApi.submit });

  const canNext = step === 1 ? motives.length > 0 : step === 3 ? density !== null : true;

  const goTo = (next: number) => {
    Keyboard.dismiss();
    go(next > step ? 1 : -1);
    setStep(next);
  };

  const back = () => {
    if (phase !== "form") return;
    if (step > 0) goTo(step - 1);
    else if (mode === "retake") router.back();
  };

  // Android 뒤로가기: 단계 안에서는 이전 단계로, 분석 중에는 막습니다
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (phase === "analyzing") return true;
      if (phase === "result") return mode === "first";
      if (step > 0) {
        Keyboard.dismiss();
        go(-1);
        setStep(step - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [phase, step, mode, go]);

  const submit = async () => {
    if (!density) return;
    Keyboard.dismiss();
    go(1);
    setPhase("analyzing");
    const minDelay = wait(MIN_ANALYSIS_MS);
    const body: OnboardingSubmissionRequest = {
      questionVersion: questions.questionVersion,
      travelStyles: styleValues,
      travelMotives: motives,
      likedRegions: regions.map((r) => r.sigCd),
      scheduleDensity: density,
      excludeTags: excluded,
    };
    try {
      const res = await submitMutation.mutateAsync(body);
      await minDelay;
      haptics.confirm();
      if (mode === "retake") {
        queryClient.invalidateQueries({ queryKey: queryKeys.myOnboarding });
        queryClient.invalidateQueries({ queryKey: queryKeys.me });
      }
      go(1);
      setSubmission(res);
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
      go(-1);
      setPhase("form");
    }
  };

  const finish = () => {
    if (mode === "first") {
      // 루트 가드(Stack.Protected)가 onboardingCompleted를 보고 탭으로 바꿔 줍니다
      queryClient.invalidateQueries({ queryKey: queryKeys.myOnboarding });
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      useAuthStore.getState().setOnboardingCompleted(true);
      return;
    }
    toast.success("여행 취향을 새로 저장했어요");
    router.back();
  };

  const contentKey = phase === "form" ? `step-${step}` : phase;

  const renderStep = () => {
    switch (step) {
      case 0:
        return <StyleStep questions={questions.travelStyles} values={styleValues} onChange={(n, v) => setStyleValues((prev) => ({ ...prev, [String(n)]: v }))} />;
      case 1:
        return <MotiveStep motives={questions.travelMotives} max={questions.maxTravelMotives} selected={motives} onChange={setMotives} />;
      case 2:
        return <RegionStep max={questions.maxLikedRegions} selected={regions} onChange={setRegions} />;
      default:
        return (
          <DensityStep
            options={questions.scheduleDensityOptions}
            density={density}
            onDensity={setDensity}
            excludeTags={questions.excludeTags}
            excluded={excluded}
            onExcluded={setExcluded}
          />
        );
    }
  };

  const skipRegions = step === 2 && regions.length === 0;

  return (
    <Screen>
      <OnboardingHeader showBack={phase === "form" && (step > 0 || mode === "retake")} onBack={back} step={phase === "form" ? step : null} total={STEP_COUNT} />

      <View style={styles.body}>
        <Animated.View key={contentKey} entering={entering} exiting={exiting} style={styles.page}>
          {phase === "form" ? renderStep() : null}
          {phase === "analyzing" ? <AnalysisView footnote="곧, 나에게 맞는 여행을 추천해 드릴게요." /> : null}
          {phase === "result" && submission ? <OnboardingResult submission={submission} motives={questions.travelMotives} regions={regions} nickname={nickname} /> : null}
        </Animated.View>
      </View>

      {phase === "form" ? (
        <BottomCTA>
          <Button
            label={step === STEP_COUNT - 1 ? "취향 분석하기" : skipRegions ? "건너뛰기" : "다음"}
            variant={skipRegions ? "secondary" : "primary"}
            disabled={!canNext}
            onPress={() => (step === STEP_COUNT - 1 ? submit() : goTo(step + 1))}
            accessibilityHint={!canNext ? (step === 1 ? "여행 동기를 하나 이상 골라주세요" : "여행 속도를 골라주세요") : undefined}
          />
        </BottomCTA>
      ) : null}
      {phase === "result" ? (
        <BottomCTA>
          <Button
            label={mode === "first" ? "핀 꽂으러 가기" : "완료"}
            leftIcon={mode === "first" ? <Icons.PinButton width={21} height={21} /> : undefined}
            onPress={finish}
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
