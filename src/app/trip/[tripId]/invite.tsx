import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { toast } from "sonner-native";

import { LINK_BASE_URL } from "@/api/config";
import { inviteApi, tripApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { FriendInvite, Participant } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, BottomCTA, Button, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { FriendPickerSheet } from "@/features/trip/components/FriendPickerSheet";
import { InlineNotice } from "@/features/trip/components/InlineNotice";
import { InviteCard } from "@/features/trip/components/InviteCard";
import { SharedPreferenceHint } from "@/features/trip/components/SharedPreferenceHint";
import { Skeleton } from "@/features/trip/components/Skeleton";
import { TravelerRow, type TravelerRowModel } from "@/features/trip/components/TravelerRow";
import { AVATAR_SIZE, TRAVELERS_POLL_MS } from "@/features/trip/constants";
import { useRegionLabel } from "@/features/trip/hooks/useRegionLabel";
import { tripFlowKeys } from "@/features/trip/queryKeys";
import { formatNights, formatRange } from "@/lib/date";
import { haptics } from "@/lib/haptics";
import { withEuro } from "@/lib/josa";
import { useAuthStore } from "@/store/auth";
import { motion, screenPadding, sizes, space } from "@/theme";

type Travelers = { participants: Participant[]; invites: FriendInvite[] };
type PendingRow = Extract<TravelerRowModel, { kind: "pending" }>;

/** 피그마 D · 친구 초대 (400:1411) */
export default function TripInviteScreen() {
  const params = useLocalSearchParams<{ tripId: string }>();
  const tripId = Number(params.tripId);
  const valid = Number.isInteger(tripId) && tripId > 0;
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const sheetRef = useRef<BottomSheetModal>(null);

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

  // 참여자 + 보낸 친구 초대를 한 번에 받아(5초마다, 화면이 보일 때만) 대기 → 함께하는 중 이동을 한 번에 그립니다.
  const travelersKey = tripFlowKeys.travelers(tripId);
  const travelers = useQuery({
    queryKey: travelersKey,
    queryFn: async (): Promise<Travelers> => {
      const [participants, invites] = await Promise.all([tripApi.participants(tripId), inviteApi.friendInvites(tripId)]);
      // 다른 화면(여행 준비·여행 홈)이 쓰는 공용 키도 같이 채워 둡니다.
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

  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.userId === me?.id) return -1;
    if (b.userId === me?.id) return 1;
    return a.joinedAt.localeCompare(b.joinedAt);
  });
  const rows: TravelerRowModel[] = [
    ...sortedParticipants.map((p): TravelerRowModel => ({ key: `u${p.userId}`, userId: p.userId, nickname: p.nickname, kind: "joined", isMe: p.userId === me?.id })),
    ...pendingInvites.map((i): TravelerRowModel => ({ key: `u${i.invitee.userId}`, userId: i.invitee.userId, nickname: i.invitee.nickname, kind: "pending", inviteId: i.id })),
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
    queryClient.setQueryData<Travelers>(travelersKey, (old) =>
      old ? { ...old, invites: [invite, ...old.invites.filter((i) => i.id !== invite.id)] } : old,
    );
    void queryClient.invalidateQueries({ queryKey: travelersKey });
  };

  const finish = () => router.replace({ pathname: "/trip/[tripId]", params: { tripId: String(tripId) } });

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
  const dateLine = `${formatRange(trip.startDate, trip.endDate)} · ${formatNights(trip.nights)}`;
  const link = inviteLink.data ? `${LINK_BASE_URL}invite/${inviteLink.data.token}` : null;
  const linkStatus = inviteLink.isError ? "error" : link ? "ready" : "loading";
  const alone = travelers.isSuccess && participants.length <= 1 && pendingInvites.length === 0;

  const copyLink = async () => {
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link);
      haptics.confirm();
      toast("링크를 복사했어요");
    } catch {
      haptics.reject();
      toast("링크를 복사하지 못했어요");
    }
  };

  const shareLink = async () => {
    if (!link) return;
    const headline = regionLabel ? `${withEuro(regionLabel)} 떠나는 여행에 함께해요!` : "TriPin 여행에 함께해요!";
    try {
      await Share.share({ message: `${headline}\n${dateLine}\n${link}` });
    } catch {
      toast("공유하지 못했어요. 링크 복사를 이용해 주세요");
    }
  };

  return (
    <Screen>
      <TopBar title="여행 준비 · 3/4" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.springify()} style={styles.intro}>
          <AppText variant="title">누구와 함께 떠날까요?</AppText>
          {/* 피그마 원문 "서로의 취향을 반영해 코스를 만들 수 있어요"는 백엔드 정책(만드는 사람 취향으로 생성)과 달라 바꿨습니다. */}
          <AppText variant="body" color="muted">
            {"친구를 초대하면 함께 코스를 고치고\n각자의 취향으로 다시 만들 수 있어요."}
          </AppText>
          <View style={styles.dates} accessible accessibilityLabel={`여행 날짜 ${dateLine}`}>
            <Icons.Calendar18 width={18} height={18} />
            <AppText variant="caption" color="darkgreen">
              {dateLine}
            </AppText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger).springify()}>
          <InviteCard
            link={link}
            status={linkStatus}
            onCopy={() => void copyLink()}
            onShare={() => void shareLink()}
            onRetry={() => void inviteLink.refetch()}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(2 * motion.stagger).springify()} style={styles.travelers}>
          <View style={styles.travelersHeader}>
            <AppText variant="label" accessibilityRole="header">
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
                <AppText variant="small12" color="muted" style={styles.emptyHint}>
                  아직 초대한 친구가 없어요. 링크를 보내거나 친구 목록에서 골라 보세요.
                </AppText>
              ) : null}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(3 * motion.stagger).springify()}>
          <SharedPreferenceHint />
        </Animated.View>
      </ScrollView>

      <BottomCTA helper={alone ? "혼자 여행할게요" : undefined} onHelperPress={alone ? finish : undefined}>
        <Button label="친구 초대 완료" onPress={finish} rightIcon={<Icons.ArrowRight width={20} height={20} />} />
      </BottomCTA>

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
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[24], gap: space[16] },
  intro: { gap: space[4] },
  dates: { flexDirection: "row", alignItems: "center", gap: space[8], minHeight: 32, marginTop: space[4] },
  travelers: { gap: space[4] },
  travelersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: sizes.touchTarget },
  fromFriends: { height: sizes.touchTarget, justifyContent: "center", paddingLeft: space[12] },
  rows: { gap: space[12] },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: space[12], minHeight: 60 },
  skeletonTexts: { flex: 1, gap: space[8] },
  emptyHint: { marginTop: space[4] },
});
