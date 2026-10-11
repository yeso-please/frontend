import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

import { onboardingApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import { Icons } from "@/components/icons";
import { BottomCTA, Button, EmptyView, ErrorView, LoadingView, Screen, TopBar } from "@/components/ui";
import { screenPadding, space } from "@/theme";

import { MbtiProfileView } from "./MbtiProfileView";
import { isMbtiType } from "./types";

const goBack = () => (router.canGoBack() ? router.back() : router.navigate("/my"));

/** MY → 나의 여행 성향. 서버가 최신 온보딩(v2)에서 계산한 mbtiCode를 보여 줍니다. */
export function MbtiResultView() {
  const onboarding = useQuery({ queryKey: queryKeys.myOnboarding, queryFn: onboardingApi.me });
  const code = onboarding.data?.submission?.mbtiCode;

  if (!isMbtiType(code)) {
    return (
      <Screen>
        <TopBar title="나의 여행 성향" onBack={goBack} />
        {onboarding.isPending ? (
          <LoadingView />
        ) : onboarding.isError ? (
          <ErrorView error={onboarding.error} onRetry={() => onboarding.refetch()} />
        ) : (
          <EmptyView
            title="아직 여행 MBTI가 없어요"
            description="취향 설문을 다시 하면 12개의 질문으로 나의 여행 성향을 알 수 있어요."
            actionLabel="취향 설문 다시 하기"
            onAction={() => router.replace("/my/taste")}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="나의 여행 성향" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MbtiProfileView type={code} />
      </ScrollView>
      <BottomCTA helper="설문 다시 하기" onHelperPress={() => router.replace("/my/taste")}>
        <Button label="이 성향으로 여행 준비하기" rightIcon={<Icons.ArrowRight width={20} height={20} />} onPress={() => router.navigate("/")} />
      </BottomCTA>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[4], paddingBottom: space[24] },
});
