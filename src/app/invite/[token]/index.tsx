import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { toast } from "sonner-native";

import { inviteApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { acceptErrorMessage, deadInviteText, isDeadInvite } from "@/features/invites/inviteErrors";
import { firstCourseBody, InviteReceiveView, joinHeading } from "@/features/invites/InviteReceiveView";
import { InlineNotice } from "@/features/trip/components/InlineNotice";
import { regionLabelFromName, tripCardTitle } from "@/features/trip/lib";
import { haptics } from "@/lib/haptics";
import { useAuthStore } from "@/store/auth";
import { usePendingInvite } from "@/store/pendingInvite";
import { space } from "@/theme";

/**
 * 피그마 D2b · 비회원 초대 수신 (tripin://invite/{token}). 로그인 전에도 열리고(4-4 공개), 로그인 상태면 D2a처럼 바로 수락합니다(4-5).
 * 비로그인·설문 전이면 토큰을 기억해 두었다가 가입·설문을 마친 뒤 홈에서 이 화면으로 돌아옵니다.
 */
export default function InviteLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const onboarded = useAuthStore((s) => s.onboardingCompleted);
  const me = useAuthStore((s) => s.user);
  const signedIn = status === "signedIn";
  const ready = signedIn && onboarded;

  const preview = useQuery({
    queryKey: queryKeys.invitePreview(token ?? ""),
    queryFn: () => inviteApi.preview(token as string),
    enabled: !!token,
    retry: (count, e) => !isDeadInvite(e) && count < 2,
  });

  // 로그인·설문을 마친 상태로 이 화면에 왔다면 기억해 둔 초대는 다 쓴 것입니다.
  useEffect(() => {
    if (ready) usePendingInvite.getState().clear();
  }, [ready]);

  const accept = useMutation({
    mutationFn: () => inviteApi.accept(token as string),
    onSuccess: (trip) => {
      haptics.confirm();
      void queryClient.invalidateQueries({ queryKey: ["trips"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.receivedInvites });
      router.replace({ pathname: "/trip/[tripId]/joined", params: { tripId: String(trip.id) } });
    },
    onError: (e) => {
      haptics.reject();
      if (isApiError(e, "ONBOARDING_REQUIRED")) {
        goSurvey();
        return;
      }
      toast(acceptErrorMessage(e));
      if (isDeadInvite(e)) void preview.refetch();
    },
  });

  const remember = () => {
    if (token) usePendingInvite.getState().remember(token);
  };
  /** 가입하고 설문까지 마치면 홈이 이 초대로 돌려보냅니다 */
  const goSignup = () => {
    remember();
    router.push("/signup");
  };
  const goLogin = () => {
    remember();
    router.push("/login");
  };
  const goSurvey = () => {
    remember();
    toast("취향 설문을 마치면 바로 참여할 수 있어요");
    useAuthStore.getState().setOnboardingCompleted(false);
    router.replace("/onboarding");
  };
  const goHome = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (!token || preview.isPending) {
    return (
      <Screen>
        <TopBar title="여행 초대" />
        <LoadingView label="초대를 확인하고 있어요" />
      </Screen>
    );
  }

  const dead = preview.isError ? isDeadInvite(preview.error) : !preview.data.valid;
  if (dead) {
    const text = preview.isError ? deadInviteText(preview.error) : deadInviteText(null);
    return (
      <Screen>
        <TopBar title="여행 초대" />
        <EmptyView title={text.title} description={text.description} actionLabel={ready ? "홈으로 가기" : undefined} onAction={ready ? () => router.replace("/") : undefined} />
      </Screen>
    );
  }
  if (preview.isError) {
    return (
      <Screen>
        <TopBar title="여행 초대" />
        <ErrorView error={preview.error} onRetry={() => void preview.refetch()} />
      </Screen>
    );
  }

  const invite = preview.data;
  const label = regionLabelFromName(invite.regionName);
  const tripTitle = tripCardTitle(invite.regionName, invite.title);
  const common = {
    tripTitle,
    startDate: invite.startDate,
    endDate: invite.endDate,
    photoUrl: invite.heroImageUrl,
    participants: invite.participants.map((p) => p.nickname),
  };
  const browse = invite.hasCourse
    ? { label: "초대 내용 둘러보기", onPress: () => router.push({ pathname: "/invite/[token]/course", params: { token } }), hint: "참여하기 전에 코스를 읽기 전용으로 둘러봐요" }
    : undefined;

  // ── 로그인 전 (D2b) ──
  if (!signedIn) {
    return (
      <InviteReceiveView
        {...common}
        heading={"함께 떠날 준비가\n되셨나요?"}
        subheading={`${invite.inviterNickname}님이 ${tripTitle}에 초대했어요.`}
        infoTitle="가입 후 함께 편집할 수 있어요."
        infoBody={firstCourseBody(invite.inviterNickname)}
        primary={{ label: "회원가입하고 참여하기", onPress: goSignup, hint: "가입하고 취향 설문을 마치면 이 여행에 참여해요" }}
        secondary={browse}
        footerLink={
          <PressableScale onPress={goLogin} style={styles.link} accessibilityRole="button" accessibilityLabel="이미 계정이 있어요, 로그인">
            <AppText variant="small12" color="muted">
              이미 계정이 있어요 · 로그인
            </AppText>
          </PressableScale>
        }
      />
    );
  }

  // ── 로그인했지만 최초 설문 전 ──
  if (!onboarded) {
    return (
      <InviteReceiveView
        {...common}
        heading={joinHeading(label)}
        subheading={`${invite.inviterNickname}님의 여행에 초대됐어요.`}
        infoTitle="취향 설문을 마치면 참여할 수 있어요."
        infoBody={firstCourseBody(invite.inviterNickname)}
        primary={{ label: "취향 설문하고 참여하기", onPress: goSurvey }}
        secondary={browse}
      />
    );
  }

  // ── 로그인·설문 완료 (D2a와 같은 모양) ──
  return (
    <InviteReceiveView
      {...common}
      heading={joinHeading(label)}
      subheading={`${me?.nickname ?? "여행자"}님, ${invite.inviterNickname}님의 여행에 초대됐어요.`}
      infoTitle="참여하면 코스를 함께 다듬어요."
      infoBody={firstCourseBody(invite.inviterNickname)}
      notice={accept.isError && !isApiError(accept.error, "ONBOARDING_REQUIRED") ? <InlineNotice title={acceptErrorMessage(accept.error)} /> : null}
      primary={{ label: "초대 수락하고 참여하기", onPress: () => accept.mutate(), loading: accept.isPending }}
      secondary={browse ?? { label: "나중에", onPress: goHome }}
      footerLink={
        browse ? (
          <PressableScale onPress={goHome} style={styles.link} accessibilityRole="button" accessibilityLabel="나중에">
            <AppText variant="small12" color="muted">
              나중에
            </AppText>
          </PressableScale>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  link: { height: 40, alignItems: "center", justifyContent: "center", marginTop: -space[4] },
});
