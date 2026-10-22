import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { toast } from "sonner-native";

import { tripApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { Participant } from "@/api/types";
import { AppText, BottomCTA, Button, ErrorView, LoadingView, Screen, TopBar } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useAuthStore } from "@/store/auth";
import { colors, motion, radius, screenPadding, space } from "@/theme";

import { ConfirmDialog } from "../components/ConfirmDialog";

type Pending = { kind: "kick"; participant: Participant } | { kind: "leave" } | null;

/** 피그마 E3 참여자 관리 — 관리자(isManager)만 다른 참여자를 내보내고(3-10), 누구나 여행에서 나갈 수 있습니다(3-9) */
export function ParticipantsScreen({ tripId }: { tripId: number }) {
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const participants = useQuery({ queryKey: queryKeys.participants(tripId), queryFn: () => tripApi.participants(tripId) });
  const [pending, setPending] = useState<Pending>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.participants(tripId) });
    void queryClient.invalidateQueries({ queryKey: ["trips", "all"] });
    void queryClient.invalidateQueries({ queryKey: ["trips", "UPCOMING"] });
  };

  const kick = useMutation({
    mutationFn: (userId: number) => tripApi.kick(tripId, userId),
    onSuccess: (_res, userId) => {
      haptics.confirm();
      const name = participants.data?.find((p) => p.userId === userId)?.nickname;
      queryClient.setQueryData<Participant[]>(queryKeys.participants(tripId), (old) => old?.filter((p) => p.userId !== userId));
      toast(`${name ?? "참여자"}님을 내보냈어요`);
      setPending(null);
      invalidate();
    },
    onError: (e) => {
      haptics.reject();
      setPending(null);
      if (isApiError(e, "TRIP_MANAGER_ONLY")) {
        toast("참여자 내보내기는 초대자만 할 수 있어요");
        invalidate();
      } else if (isApiError(e, "TRIP_PARTICIPANT_NOT_FOUND")) {
        toast("이미 여행에서 나간 사람이에요");
        invalidate();
      } else toast(errorMessage(e));
    },
  });

  const leave = useMutation({
    mutationFn: () => tripApi.leave(tripId),
    onSuccess: () => {
      haptics.confirm();
      setPending(null);
      queryClient.removeQueries({ queryKey: ["trips", tripId] });
      invalidate();
      toast("여행에서 나왔어요");
      router.dismissTo("/(tabs)");
    },
    onError: (e) => {
      setPending(null);
      toast(errorMessage(e));
    },
  });

  const list = participants.data ?? [];
  const iAmManager = list.some((p) => p.userId === myId && p.isManager);

  return (
    <Screen>
      <TopBar title="참여자 관리" />
      {participants.isPending ? (
        <LoadingView />
      ) : participants.isError ? (
        <ErrorView error={participants.error} onRetry={() => participants.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <AppText variant="title" accessibilityRole="header">
            함께하는 여행자
          </AppText>
          <AppText variant="body" color="muted" style={styles.lead}>
            여행 참여와 초대 권한을 관리해요.
          </AppText>

          <View style={styles.list}>
            {list.map((p, index) => {
              const isMe = p.userId === myId;
              const role = p.isCreator ? "초대자" : "참여 완료";
              return (
                <Animated.View key={p.userId} entering={FadeInDown.delay(index * motion.stagger).springify()} layout={LinearTransition} style={styles.card}>
                  <AppText variant="label">{isMe ? `${p.nickname} · 나` : p.nickname}</AppText>
                  <AppText variant="small12" color="muted">{`${role} · 취향 설문 완료${p.isManager && !p.isCreator ? " · 관리자" : ""}`}</AppText>
                  {iAmManager && !isMe ? (
                    <Button
                      label="참여자 내보내기"
                      variant="secondary"
                      height={48}
                      style={styles.kick}
                      onPress={() => setPending({ kind: "kick", participant: p })}
                    />
                  ) : null}
                </Animated.View>
              );
            })}
          </View>

          <AppText variant="small12" color="muted">
            참여자 내보내기는 초대자만 할 수 있어요.
          </AppText>
          <AppText variant="small12" color="blue">
            내보낸 친구도 다시 초대하면 함께할 수 있어요.
          </AppText>
        </ScrollView>
      )}

      <BottomCTA>
        <Button label="여행에서 나가기" variant="secondary" onPress={() => setPending({ kind: "leave" })} />
      </BottomCTA>

      <ConfirmDialog
        visible={pending?.kind === "kick"}
        title={pending?.kind === "kick" ? `${pending.participant.nickname}님을 내보낼까요?` : ""}
        body={pending?.kind === "kick" ? `${pending.participant.nickname}님은 이 여행의 코스를 편집할 수 없게 돼요.` : undefined}
        confirmLabel="내보내기"
        destructive
        loading={kick.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending?.kind === "kick" && kick.mutate(pending.participant.userId)}
      />
      <ConfirmDialog
        visible={pending?.kind === "leave"}
        title="여행에서 나갈까요?"
        body={
          list.length <= 1
            ? "마지막 참여자가 나가면 여행과 코스가 지워져요. 그 기간은 다시 다른 여행에 쓸 수 있어요."
            : "내 여행 목록에서 사라지고, 다른 참여자의 여행과 코스는 그대로 남아요."
        }
        confirmLabel="나가기"
        destructive
        loading={leave.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => leave.mutate()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[24], paddingBottom: space[32], gap: space[12] },
  lead: { marginTop: -space[4], marginBottom: space[8] },
  list: { gap: space[12] },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[16], gap: space[4] },
  kick: { marginTop: space[8] },
});
