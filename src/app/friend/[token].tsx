import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { toast } from "sonner-native";

import { friendApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, Button, EmptyView, ErrorView, LoadingView, Screen, TopBar } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useAuthStore } from "@/store/auth";
import { colors, motion, screenPadding, space } from "@/theme";

const DEAD_LINK: Record<string, string> = {
  FRIEND_LINK_NOT_FOUND: "없는 친구 초대 링크예요.",
  FRIEND_LINK_EXPIRED: "기간이 지난 친구 초대 링크예요. 새 링크를 받아 주세요.",
  FRIEND_LINK_REVOKED: "보낸 사람이 닫은 친구 초대 링크예요.",
  TOKEN_AUDIENCE_MISMATCH: "친구 초대 링크가 아니에요.",
};
const deadLinkText = (e: unknown) => (isApiError(e) ? DEAD_LINK[e.code] : undefined);

/**
 * 친구 초대 링크 (tripin://friend/{token}) — 2-7 미리보기(공개) → 2-8 수락하면 바로 친구가 됩니다.
 * 피그마 디자인이 없어 D2 초대 수신 화면의 말투·구성을 따릅니다. 로그인 전이면 로그인 뒤 링크를 다시 열도록 안내합니다.
 */
export default function FriendLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((s) => s.status === "signedIn");
  const me = useAuthStore((s) => s.user);

  const preview = useQuery({
    queryKey: queryKeys.friendLink(token ?? ""),
    queryFn: () => friendApi.previewLink(token as string),
    enabled: !!token,
    retry: (count, e) => !deadLinkText(e) && count < 2,
  });

  const accept = useMutation({
    mutationFn: () => friendApi.acceptLink(token as string),
    onSuccess: (friend) => {
      haptics.confirm();
      void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      toast(`${friend.nickname}님과 친구가 됐어요`);
      router.replace("/my/friends");
    },
    onError: (e) => {
      haptics.reject();
      if (isApiError(e, "FRIEND_LINK_SELF")) toast("내가 만든 링크예요. 친구에게 보내 주세요.");
      else toast(deadLinkText(e) ?? errorMessage(e));
    },
  });

  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (preview.isPending) {
    return (
      <Screen>
        <TopBar title="친구 초대" onBack={leave} />
        <LoadingView />
      </Screen>
    );
  }
  if (preview.isError) {
    const dead = deadLinkText(preview.error);
    return (
      <Screen>
        <TopBar title="친구 초대" onBack={leave} />
        {dead ? <EmptyView title="열 수 없는 링크예요" description={dead} actionLabel="홈으로" onAction={() => router.replace("/")} /> : <ErrorView error={preview.error} onRetry={() => void preview.refetch()} />}
      </Screen>
    );
  }

  const inviter = preview.data.inviterNickname;
  return (
    <Screen>
      <TopBar title="친구 초대" onBack={leave} />
      <View style={styles.body}>
        <Animated.View entering={ZoomIn.springify().damping(motion.spring.bouncy.damping)} style={styles.avatar}>
          <AppText variant="title" color="darkgreen">
            {inviter.slice(0, 1)}
          </AppText>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(motion.stagger).springify()} style={styles.texts}>
          <AppText variant="title" align="center" accessibilityRole="header">
            {`${inviter}님이\n친구 초대를 보냈어요`}
          </AppText>
          <AppText variant="body" color="muted" align="center">
            친구가 되면 여행을 만들 때 서로를 바로 초대할 수 있어요.
          </AppText>
        </Animated.View>
      </View>
      <View style={styles.actions}>
        {signedIn ? (
          <>
            <Button label={`${inviter}님과 친구 맺기`} loading={accept.isPending} onPress={() => accept.mutate()} accessibilityHint={me ? `${me.nickname}님의 친구 목록에 추가돼요` : undefined} />
            <Button label="나중에" variant="secondary" height={48} onPress={leave} />
          </>
        ) : (
          <>
            <AppText variant="small13" color="muted" align="center">
              로그인한 뒤 이 링크를 다시 열면 친구를 맺을 수 있어요.
            </AppText>
            <Button label="로그인하러 가기" onPress={() => router.replace("/login")} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: screenPadding, gap: space[24] },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  texts: { gap: space[12] },
  actions: { paddingHorizontal: screenPadding, paddingBottom: space[16], gap: space[12] },
});
