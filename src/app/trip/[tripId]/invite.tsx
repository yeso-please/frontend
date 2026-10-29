import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { shareUrl } from "@/api/config";
import { inviteApi, tripApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { FriendInvite, Participant, SentFriendInvite } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, Button, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { FriendPickerSheet } from "@/features/trip/components/FriendPickerSheet";
import { InlineNotice } from "@/features/trip/components/InlineNotice";
import { SentLinkList } from "@/features/share/SentLinkList";
import { InviteCard } from "@/features/trip/components/InviteCard";
import { Skeleton } from "@/features/trip/components/Skeleton";
import { TravelerRow, type TravelerRowModel } from "@/features/trip/components/TravelerRow";
import { TripSummaryCard } from "@/features/trip/components/TripSummaryCard";
import { AVATAR_SIZE, TRAVELERS_POLL_MS } from "@/features/trip/constants";
import { useRegionLabel } from "@/features/trip/hooks/useRegionLabel";
import { tripFlowKeys } from "@/features/trip/queryKeys";
import { formatNights, formatRange } from "@/lib/date";
import { haptics } from "@/lib/haptics";
import { withEuro } from "@/lib/josa";
import { useAuthStore } from "@/store/auth";
import { colors, motion, radius, screenPadding, sizes, space } from "@/theme";

type Travelers = { participants: Participant[]; invites: SentFriendInvite[] };
type PendingRow = Extract<TravelerRowModel, { kind: "pending" }>;

const enter = (i: number) => FadeInDown.delay(motion.stagger * i).springify().damping(motion.spring.gentle.damping);

/** 피그마 D1 · 친구 초대 / D1a · 초대 전송 완료 (여행 준비 3/4) */
export default function TripInviteScreen() {
  const params = useLocalSearchParams<{ tripId: string; from?: string }>();
  const tripId = Number(params.tripId);
  const valid = Number.isInteger(tripId) && tripId > 0;
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const sheetRef = useRef<BottomSheetModal>(null);
  /** D1a — 링크를 공유·복사했거나 친구 초대를 보냈으면 "초대 링크를 공유했어요"를 보여 줍니다 */
  const [shared, setShared] = useState(false);

  const context = useQuery({ queryKey: queryKeys.tripContext(tripId), queryFn: () => tripApi.context(tripId), enabled: valid });
  const regionLabel = useRegionLabel(context.data?.regionSigCd);

  // token 원문은 발급 응답에서만 받을 수 있어 화면에 처음 들어올 때 한 번만 발급하고 계속 씁니다.
  const inviteLink = useQuery({
    queryKey: tripFlowKeys.inviteLink(tripId),
    queryFn: () => inviteApi.issue(tripId),
    enabled: valid && context.isSuccess,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // 4-2 이 여행에서 보낸 초대 링크 (다른 참여자가 만든 링크도 보이고 취소할 수 있어요)
  const inviteLinks = useQuery({ queryKey: queryKeys.inviteLinks(tripId), queryFn: () => inviteApi.list(tripId), enabled: valid && inviteLink.isSuccess });
  const revokeLink = useMutation({
    mutationFn: (inviteId: number) => inviteApi.revoke(tripId, inviteId),
    onSuccess: async (_data, inviteId) => {
      haptics.confirm();
      toast("초대 링크를 취소했어요");
      // 화면에 보이던 링크를 취소했으면 새 링크를 받아 둡니다
      if (inviteId === inviteLink.data?.id) await queryClient.resetQueries({ queryKey: tripFlowKeys.inviteLink(tripId) });
    },
    onError: (e) => toast(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.inviteLinks(tripId) }),
  });

  // 참여자 + 보낸 친구 초대를 한 번에 받아(5초마다, 화면이 보일 때만) 대기 → 참여 이동을 한 번에 그립니다.
  const travelersKey = tripFlowKeys.travelers(tripId);
  const travelers = useQuery({
    queryKey: travelersKey,
    queryFn: async (): Promise<Travelers> => {
      const [participants, invites] = await Promise.all([tripApi.participants(tripId), inviteApi.friendInvites(tripId)]);
      // 홈 카드(준비 단계)·코스 화면이 쓰는 공용 키도 같이 채워 둡니다.
      queryClient.setQueryData(queryKeys.participants(tripId), participants);
      queryClient.setQueryData(queryKeys.friendInvites(tripId), invites);
      return { participants, invites };
    },
    enabled: valid,
    refetchInterval: isFocused ? TRAVELERS_POLL_MS : false,
  });

  const participants = travelers.data?.participants ?? [];
  const joinedIds = new Set(participants.map((p) => p.userId));
  const pendingInvites = (travelers.data?.invites ?? []).filter((i) => i.status === "PENDING" && !joinedIds.has(i.invitee.userId));
  const pendingIds = new Set(pendingInvites.map((i) => i.invitee.userId));
  const creator = participants.find((p) => p.isCreator) ?? participants[0];

  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.userId === me?.id) return -1;
    if (b.userId === me?.id) return 1;
    return a.joinedAt.localeCompare(b.joinedAt);
  });
  const rows: TravelerRowModel[] = [
    ...sortedParticipants.map(
      (p): TravelerRowModel => ({
        key: `u${p.userId}`,
        userId: p.userId,
        nickname: p.nickname,
        kind: "joined",
        tag: p.userId === me?.id ? "나" : undefined,
        // 참여자는 모두 최초 설문을 마친 회원입니다 (서버 규칙).
        status: p.userId === me?.id ? "취향 설문 완료" : "참여 완료 · 취향 설문 완료",
      }),
    ),
    ...pendingInvites.map(
      (i): TravelerRowModel => ({
        key: `u${i.invitee.userId}`,
        userId: i.invitee.userId,
        nickname: i.invitee.nickname,
        kind: "pending",
        inviteId: i.id,
        status: shared ? "초대 전송 · 응답 대기" : "응답 대기 중",
      }),
    ),
  ];

  // 대기 중이던 친구가 참여자가 되면 살짝 알려 줍니다.
  const previousPending = useRef<Map<number, string> | null>(null);
  useEffect(() => {
    const data = travelers.data;
    if (!data) return;
    const joinedNow = new Set(data.participants.map((p) => p.userId));
    if (previousPending.current) {
      for (const [userId, nickname] of previousPending.current) {
        if (joinedNow.has(userId)) {
          haptics.confirm();
          toast(`${nickname}님이 여행에 함께해요`);
        }
      }
    }
    previousPending.current = new Map(
      data.invites.filter((i) => i.status === "PENDING" && !joinedNow.has(i.invitee.userId)).map((i) => [i.invitee.userId, i.invitee.nickname] as const),
    );
  }, [travelers.data]);

  const cancelInvite = useMutation({
    mutationFn: (row: PendingRow) => inviteApi.cancelFriendInvite(tripId, row.inviteId),
    onMutate: async (row) => {
      await queryClient.cancelQueries({ queryKey: travelersKey });
      const previous = queryClient.getQueryData<Travelers>(travelersKey);
      queryClient.setQueryData<Travelers>(travelersKey, (old) =>
        old ? { ...old, invites: old.invites.map((i) => (i.id === row.inviteId ? { ...i, status: "CANCELLED" } : i)) } : old,
      );
      return { previous };
    },
    onSuccess: (_data, row) => toast(`${row.nickname}님 초대를 취소했어요`),
    onError: (e, _row, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(travelersKey, ctx.previous);
      haptics.reject();
      toast(isApiError(e, "INVITE_ALREADY_HANDLED") ? "이미 응답한 초대예요" : errorMessage(e));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: travelersKey }),
  });

  const onInvited = (invite: FriendInvite) => {
    const sent: SentFriendInvite = { id: invite.id, invitee: invite.invitee, inviter: { userId: me?.id ?? 0, nickname: me?.nickname ?? "" }, status: invite.status, createdAt: invite.createdAt };
    queryClient.setQueryData<Travelers>(travelersKey, (old) => (old ? { ...old, invites: [sent, ...old.invites.filter((i) => i.id !== invite.id)] } : old));
    void queryClient.invalidateQueries({ queryKey: travelersKey });
    setShared(true);
  };

  /** 3/4 → 4/4 코스. 코스 화면은 prep을 보고 "친구 초대"로 되돌려 보내지 않고 "여행 준비 완료"로 끝맺습니다. */
  const finish = (solo: boolean) => {
    void queryClient.invalidateQueries({ queryKey: ["trips"] });
    // 코스 화면의 "친구 초대하기"로 들어왔으면 그 코스 화면으로 돌아갑니다 (코스 화면이 두 번 쌓이지 않게).
    if (params.from === "course" && router.canGoBack()) router.back();
    else router.replace({ pathname: "/trip/[tripId]", params: { tripId: String(tripId), prep: solo ? "solo" : "friends" } });
  };

  if (!valid || (context.isError && isApiError(context.error, "TRIP_NOT_FOUND"))) {
    return (
      <Screen>
        <TopBar title="여행 준비 · 3/4" />
        <EmptyView title="여행을 찾을 수 없어요" description="이미 나간 여행이거나 없는 여행이에요." actionLabel="홈으로 가기" onAction={() => router.dismissTo("/")} />
      </Screen>
    );
  }
  if (context.isError) {
    return (
      <Screen>
        <TopBar title="여행 준비 · 3/4" />
        <ErrorView error={context.error} onRetry={() => void context.refetch()} />
      </Screen>
    );
  }
  if (context.isPending) {
    return (
      <Screen>
        <TopBar title="여행 준비 · 3/4" />
        <LoadingView />
      </Screen>
    );
  }

  const trip = context.data;
  const tripTitle = regionLabel ? `${regionLabel} 여행` : null;
  const link = inviteLink.data ? shareUrl(`invite/${inviteLink.data.token}`) : null;
  const linkStatus = inviteLink.isError ? "error" : link ? "ready" : "loading";
  const alone = travelers.isSuccess && participants.length <= 1 && pendingInvites.length === 0;
  const creatorName = creator ? (creator.userId === me?.id ? (me?.nickname ?? creator.nickname) : creator.nickname) : (me?.nickname ?? "");

  const copyLink = async () => {
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link);
      haptics.confirm();
      toast("링크를 복사했어요");
      setShared(true);
    } catch {
      haptics.reject();
      toast("링크를 복사하지 못했어요");
    }
  };

  const shareLink = async () => {
    if (!link) return;
    const headline = regionLabel ? `${withEuro(regionLabel)} 떠나는 여행에 함께해요!` : "TriPin 여행에 함께해요!";
    try {
      const result = await Share.share({ message: `${headline}\n${formatRange(trip.startDate, trip.endDate)} · ${formatNights(trip.nights)}\n${link}` });
      if (result.action === Share.sharedAction) {
        haptics.confirm();
        setShared(true);
      }
    } catch {
      toast("공유하지 못했어요. 링크 복사를 이용해 주세요");
    }
  };

  return (
    <Screen>
      <TopBar title="여행 준비 · 3/4" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)} style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {"누구와 함께\n떠날까요?"}
          </AppText>
          <AppText variant="body" color="muted">
            {"친구를 초대하면 서로의 취향을 반영해\n여행을 함께 준비할 수 있어요."}
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <TripSummaryCard title={tripTitle} startDate={trip.startDate} endDate={trip.endDate} />
        </Animated.View>

        {shared ? (
          <Animated.View entering={FadeInDown.springify().damping(motion.spring.gentle.damping)} layout={LinearTransition.springify()} style={styles.sharedBanner} accessibilityRole="alert">
            <AppText variant="label" color="blue">
              ✓ 초대 링크를 공유했어요
            </AppText>
            <AppText variant="small12" color="muted">
              친구가 참여하면 아래 목록에서 확인할 수 있어요.
            </AppText>
          </Animated.View>
        ) : null}

        <Animated.View entering={enter(2)} layout={LinearTransition.springify()} style={styles.linkBlock}>
          <InviteCard link={link} status={linkStatus} onCopy={() => void copyLink()} onShare={() => void shareLink()} onRetry={() => void inviteLink.refetch()} />
          <AppText variant="small12" color="blue">
            초대 링크를 친구에게 보내주세요.
          </AppText>
          {inviteLinks.data && inviteLinks.data.length > 0 ? (
            <View style={styles.sentLinks}>
              <AppText variant="bold14">보낸 초대 링크</AppText>
              <SentLinkList
                links={inviteLinks.data}
                detail={(l) => (l.createdBy.userId === me?.id ? null : `${l.createdBy.nickname}님이 만든 링크`)}
                revokeMessage="이 링크로는 더 이상 참여할 수 없어요. 이미 참여한 친구는 그대로예요."
                onRevoke={(l) => revokeLink.mutate(l.id)}
                revokingId={revokeLink.isPending ? (revokeLink.variables ?? null) : null}
              />
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={enter(3)} layout={LinearTransition.springify()} style={styles.travelers}>
          <View style={styles.travelersHeader}>
            <AppText variant="taskTitle" accessibilityRole="header">
              {travelers.isSuccess ? `함께하는 여행자  ${participants.length}` : "함께하는 여행자"}
            </AppText>
            <PressableScale onPress={() => sheetRef.current?.present()} style={styles.fromFriends} accessibilityRole="button" accessibilityHint="친구 목록을 열어 초대할 친구를 골라요">
              <AppText variant="caption" color="blue">
                친구 목록에서 초대
              </AppText>
            </PressableScale>
          </View>

          {travelers.isPending ? (
            <View style={styles.rows}>
              {[0, 1].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} rounded={AVATAR_SIZE / 2} />
                  <View style={styles.skeletonTexts}>
                    <Skeleton width="40%" height={14} />
                    <Skeleton width="28%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          ) : travelers.isError ? (
            <InlineNotice tone="neutral" title="함께하는 여행자를 불러오지 못했어요" lines={[errorMessage(travelers.error)]} actionLabel="다시 시도" onAction={() => void travelers.refetch()} />
          ) : (
            <View style={styles.rows}>
              {rows.map((row, i) => (
                <TravelerRow
                  key={row.key}
                  row={row}
                  index={i}
                  onCancel={(r) => cancelInvite.mutate(r)}
                  cancelling={cancelInvite.isPending && row.kind === "pending" && cancelInvite.variables?.inviteId === row.inviteId}
                />
              ))}
              {alone ? (
                <AppText variant="small12" color="muted">
                  아직 초대한 친구가 없어요. 링크를 보내거나 친구 목록에서 골라 보세요.
                </AppText>
              ) : null}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={enter(4)} layout={LinearTransition.springify()} style={styles.firstCourse}>
          <AppText variant="label" color="darkgreen">{`첫 코스는 ${creatorName}님의 성향으로`}</AppText>
          <AppText variant="small13" color="darkgreen">
            {"친구의 취향은 참여 후 장소를 추가하거나\n제외하는 과정에서 함께 반영해요."}
          </AppText>
        </Animated.View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <Button label="친구 초대 완료" onPress={() => finish(false)} rightIcon={<Icons.ArrowRight width={20} height={20} />} />
        <Button label="혼자 여행할게요" variant="secondary" height={48} onPress={() => finish(true)} accessibilityHint="친구 없이 코스 만들기로 넘어가요" />
      </View>

      <FriendPickerSheet
        sheetRef={sheetRef}
        tripId={tripId}
        joinedIds={joinedIds}
        pendingIds={pendingIds}
        onInvited={onInvited}
        onStale={() => void queryClient.invalidateQueries({ queryKey: travelersKey })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[24], paddingBottom: space[24], gap: space[16] },
  intro: { gap: space[8], marginBottom: space[8] },
  sharedBanner: { borderRadius: radius.lg, backgroundColor: colors.paleblue, padding: space[16], gap: space[4] },
  linkBlock: { gap: space[12] },
  sentLinks: { gap: space[8], marginTop: space[8] },
  travelers: { gap: space[4], marginTop: space[8] },
  travelersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: sizes.touchTarget },
  fromFriends: { height: sizes.touchTarget, justifyContent: "center", paddingLeft: space[12] },
  rows: { gap: space[8] },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: space[12], minHeight: 60 },
  skeletonTexts: { flex: 1, gap: space[8] },
  firstCourse: { borderRadius: radius.lg, backgroundColor: colors.mint, padding: space[16], gap: space[8] },
  actions: { paddingTop: space[12], paddingHorizontal: screenPadding, gap: space[12], backgroundColor: colors.white },
});
