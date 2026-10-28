import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import { toast } from "sonner-native";

import { shareUrl } from "@/api/config";
import { friendApi } from "@/api/endpoints";
import { errorMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, BottomCTA, Button, ErrorView, LoadingView, Screen, TopBar } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useAuthStore } from "@/store/auth";
import { colors, screenPadding, space } from "@/theme";

import { SentLinkList } from "./SentLinkList";

/** MY → 보낸 친구 초대 링크 (2-4 보내기, 2-5 목록, 2-6 취소). 취소해도 이미 맺은 친구는 그대로입니다. */
export function FriendLinksScreen() {
  const queryClient = useQueryClient();
  const nickname = useAuthStore((s) => s.user?.nickname);
  const links = useQuery({ queryKey: queryKeys.myFriendLinks, queryFn: friendApi.links });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.myFriendLinks });

  const send = useMutation({
    mutationFn: async () => {
      const link = await friendApi.issueLink();
      await Share.share({ message: `${nickname ?? "친구"}님이 TriPin 친구 초대를 보냈어요. 친구가 되면 여행에 바로 초대할 수 있어요.\n${shareUrl(`friend/${link.token}`)}` });
    },
    onError: (e) => toast(errorMessage(e)),
    onSettled: refresh,
  });

  const revoke = useMutation({
    mutationFn: (id: number) => friendApi.revokeLink(id),
    onSuccess: () => {
      haptics.confirm();
      toast("친구 초대 링크를 취소했어요");
    },
    onError: (e) => toast(errorMessage(e)),
    onSettled: refresh,
  });

  return (
    <Screen>
      <TopBar title="친구 초대 링크" />
      {links.isPending ? (
        <LoadingView />
      ) : links.isError ? (
        <ErrorView error={links.error} onRetry={() => void links.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={links.isRefetching} onRefresh={() => void links.refetch()} colors={[colors.green]} />}
        >
          <View style={styles.intro}>
            <AppText variant="title" accessibilityRole="header">
              보낸 친구 초대 링크
            </AppText>
            <AppText variant="body" color="muted">
              링크를 받은 사람이 수락하면 바로 친구가 돼요. 더 쓰지 않을 링크는 취소해 두세요.
            </AppText>
          </View>
          <SentLinkList
            links={links.data}
            detail={(l) => (l.acceptedCount > 0 ? `이 링크로 ${l.acceptedCount}명이 친구가 됐어요` : "아직 이 링크로 친구가 된 사람이 없어요")}
            revokeMessage="이 링크로는 더 이상 친구를 맺을 수 없어요. 이미 친구가 된 사람은 그대로예요."
            onRevoke={(l) => revoke.mutate(l.id)}
            revokingId={revoke.isPending ? (revoke.variables ?? null) : null}
          />
        </ScrollView>
      )}
      <BottomCTA>
        <Button label="새 친구 초대 링크 보내기" loading={send.isPending} onPress={() => send.mutate()} />
      </BottomCTA>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[32], gap: space[24] },
  intro: { gap: space[8] },
});
