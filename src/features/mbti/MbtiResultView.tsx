import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";

import { onboardingApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import { EmptyView, ErrorView, LoadingView, Screen, TopBar } from "@/components/ui";

import { PersonaResult } from "./PersonaResult";
import { isMbtiType } from "./types";

const goBack = () => (router.canGoBack() ? router.back() : router.navigate("/(tabs)/my"));

/** MY·홈 → 나의 여행 성향 (피그마 C6). 서버가 최신 설문(v2)에서 계산한 mbtiCode를 보여 줍니다. */
export function MbtiResultView() {
  const onboarding = useQuery({ queryKey: queryKeys.myOnboarding, queryFn: onboardingApi.me });
  const code = onboarding.data?.submission?.mbtiCode;

  return (
    <Screen>
      <TopBar title="나의 여행 성향" onBack={goBack} />
      {isMbtiType(code) ? (
        <PersonaResult type={code} onMakeCourse={() => router.navigate("/(tabs)/travel")} onRetake={() => router.push("/survey")} />
      ) : onboarding.isPending ? (
        <LoadingView />
      ) : onboarding.isError ? (
        <ErrorView error={onboarding.error} onRetry={() => onboarding.refetch()} />
      ) : (
        // 예전 설문(v1)에는 여행 MBTI가 없어 성향을 알 수 없습니다
        <EmptyView
          title="아직 나의 여행 성향이 없어요"
          description="성향검사를 하면 몇 가지 질문으로 나에게 맞는 여행 성향을 알려 드려요."
          actionLabel="성향검사 하기"
          onAction={() => router.replace("/survey")}
        />
      )}
    </Screen>
  );
}
