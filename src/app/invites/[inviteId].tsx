import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet } from "react-native";
import { toast } from "sonner-native";

import { inviteApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { acceptErrorMessage } from "@/features/invites/inviteErrors";
import { firstCourseBody, InviteReceiveView, joinHeading } from "@/features/invites/InviteReceiveView";
import { useReceivedInvites } from "@/features/invites/useReceivedInvites";
import { InlineNotice } from "@/features/trip/components/InlineNotice";
import { regionLabelFromName, tripCardTitle } from "@/features/trip/lib";
import { haptics } from "@/lib/haptics";
import { useAuthStore } from "@/store/auth";
import { space } from "@/theme";

/** 피그마 D2a · 회원 초대 수신 — 친구가 보낸 여행 초대(4-7)를 수락·거절합니다 (4-8). */
export default function ReceivedInviteScreen() {
  const params = useLocalSearchParams<{ inviteId: string }>();
  const inviteId = Number(params.inviteId);
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const invites = useReceivedInvites();
  const invite = invites.data?.find((i) => i.id === inviteId);

  const afterHandled = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.receivedInvites });
    void queryClient.invalidateQueries({ queryKey: ["trips"] });
  };

  const accept = useMutation({
    mutationFn: () => inviteApi.acceptReceived(inviteId),
    onSuccess: (trip) => {
      haptics.confirm();
      afterHandled();
      router.replace({ pathname: "/trip/[tripId]/joined", params: { tripId: String(trip.id) } });
    },
    onError: (e) => {
      haptics.reject();
      if (isApiError(e, "ONBOARDING_REQUIRED")) {
        toast("취향 설문을 먼저 마쳐 주세요");
        useAuthStore.getState().setOnboardingCompleted(false);
        return;
      }
      toast(acceptErrorMessage(e));
      if (isApiError(e, "INVITE_ALREADY_HANDLED") || isApiError(e, "INVITE_NOT_FOUND")) afterHandled();
    },
  });

  const decline = useMutation({
    mutationFn: () => inviteApi.declineReceived(inviteId),
    onSuccess: () => {
      haptics.confirm();
      toast("초대를 거절했어요");
      afterHandled();
      if (router.canGoBack()) router.back();
      else router.replace("/invites");
    },
    onError: (e) => {
      haptics.reject();
      toast(isApiError(e, "INVITE_ALREADY_HANDLED") ? "이미 응답했거나 취소된 초대예요" : errorMessage(e));
    },
  });

  if (invites.isPending) {
    return (
      <Screen>
        <TopBar title="여행 초대" />
        <LoadingView />
      </Screen>
    );
  }
  if (invites.isError) {
    return (
      <Screen>
        <TopBar title="여행 초대" />
        <ErrorView error={invites.error} onRetry={() => void invites.refetch()} />
      </Screen>
    );
  }
  if (!invite) {
    return (
      <Screen>
        <TopBar title="여행 초대" />
        <EmptyView title="이미 응답했거나 취소된 초대예요" description="받은 초대 목록에서 다른 초대를 확인해 보세요." actionLabel="받은 초대 보기" onAction={() => router.replace("/invites")} />
      </Screen>
    );
  }

  const label = regionLabelFromName(invite.trip.regionName);
  const confirmDecline = () =>
    Alert.alert("초대를 거절할까요?", `${invite.inviter.nickname}님에게는 따로 알리지 않아요.`, [
      { text: "취소", style: "cancel" },
      { text: "거절", style: "destructive", onPress: () => decline.mutate() },
    ]);

  return (
    <InviteReceiveView
      heading={joinHeading(label)}
      subheading={`${me?.nickname ?? "여행자"}님, ${invite.inviter.nickname}님의 여행에 초대됐어요.`}
      tripTitle={tripCardTitle(invite.trip.regionName, invite.trip.title)}
      startDate={invite.trip.startDate}
      endDate={invite.trip.endDate}
      photoUrl={invite.trip.heroImageUrl}
      participants={invite.trip.participants.map((p) => p.nickname)}
      infoTitle="참여하면 코스를 함께 다듬어요."
      infoBody={firstCourseBody(invite.inviter.nickname)}
      notice={
        invite.dateConflict ? <InlineNotice title="이 기간에 내 다른 여행이 있어요" lines={["겹치는 여행에서 나온 뒤 수락할 수 있어요."]} /> : null
      }
      primary={{
        label: "초대 수락하고 참여하기",
        onPress: () => accept.mutate(),
        loading: accept.isPending,
        disabled: invite.dateConflict || decline.isPending,
        hint: invite.dateConflict ? "내 다른 여행과 날짜가 겹쳐 수락할 수 없어요" : undefined,
      }}
      secondary={{ label: "나중에", onPress: () => (router.canGoBack() ? router.back() : router.replace("/")) }}
      footerLink={
        <PressableScale onPress={confirmDecline} disabled={decline.isPending || accept.isPending} style={styles.decline} accessibilityRole="button" accessibilityLabel="초대 거절하기">
          <AppText variant="small12" color="muted">
            {decline.isPending ? "거절하는 중" : "초대 거절하기"}
          </AppText>
        </PressableScale>
      }
    />
  );
}

const styles = StyleSheet.create({
  decline: { height: 40, alignItems: "center", justifyContent: "center", marginTop: -space[4] },
});
