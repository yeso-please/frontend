import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type RefObject, useEffect } from "react";
import { BackHandler, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { friendApi, inviteApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { Friend, FriendInvite } from "@/api/types";
import { AppText, ErrorView, LoadingView, PressableScale } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { colors, radius, screenPadding, shadows, sizes, space } from "@/theme";

import { Avatar } from "./Avatar";

type ListProps = {
  tripId: number;
  /** 이미 함께하는 친구 */
  joinedIds: Set<number>;
  /** 응답을 기다리는 친구 */
  pendingIds: Set<number>;
  /** 초대를 보냈을 때 (목록을 바로 갱신하도록) */
  onInvited: (invite: FriendInvite) => void;
  /** 초대 처리 결과가 이미 바뀌어 있을 때 목록을 새로 받도록 */
  onStale: () => void;
};

type Props = ListProps & { sheetRef: RefObject<BottomSheetModal | null> };

const renderBackdrop = (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />;

/** "친구 목록에서 초대" 시트 (피그마 미디자인 — 토큰만 맞춤). 열릴 때만 GET /friends 를 부릅니다. */
export function FriendPickerSheet({ sheetRef, ...listProps }: Props) {
  const { height } = useWindowDimensions();
  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      maxDynamicContentSize={Math.round(height * 0.7)}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
      accessibilityLabel="친구 목록"
    >
      <FriendList {...listProps} onClose={() => sheetRef.current?.dismiss()} />
    </BottomSheetModal>
  );
}

function FriendList({ tripId, joinedIds, pendingIds, onInvited, onStale, onClose }: ListProps & { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const friends = useQuery({ queryKey: queryKeys.friends, queryFn: friendApi.list });

  // 시트가 열려 있는 동안 안드로이드 뒤로 가기는 시트만 닫습니다.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const invite = useMutation({
    mutationFn: (friend: Friend) => inviteApi.inviteFriend(tripId, friend.userId),
    onSuccess: (created, friend) => {
      haptics.confirm();
      onInvited(created);
      toast(`${friend.nickname}님에게 초대를 보냈어요`, { description: "받은 초대에서 수락하면 함께해요" });
    },
    onError: (e, friend) => {
      haptics.reject();
      if (isApiError(e, "INVITE_ALREADY_HANDLED")) {
        toast(`${friend.nickname}님은 이미 함께하고 있어요`);
        onStale();
      } else if (isApiError(e, "FRIEND_NOT_FOUND")) {
        toast("친구 목록에 없는 회원이에요");
        void friends.refetch();
      } else if (isApiError(e, "TRIP_FULL")) {
        toast("참여 인원(8명)이 꽉 찼어요");
      } else {
        toast(errorMessage(e));
      }
    },
  });

  return (
    <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[24] }]}>
      <View style={styles.header}>
        <AppText variant="cardTitle" accessibilityRole="header">
          친구 목록에서 초대
        </AppText>
        <AppText variant="small13" color="muted">
          초대받은 친구가 받은 초대에서 수락하면 함께해요.
        </AppText>
      </View>

      {friends.isPending ? (
        <View style={styles.state}>
          <LoadingView label="친구 목록을 불러오는 중이에요" />
        </View>
      ) : friends.isError ? (
        <View style={styles.state}>
          <ErrorView error={friends.error} onRetry={() => void friends.refetch()} />
        </View>
      ) : friends.data.length === 0 ? (
        <Animated.View entering={FadeIn} style={styles.empty}>
          <AppText variant="label" align="center">
            아직 친구가 없어요
          </AppText>
          <AppText variant="small13" color="muted" align="center">
            {"MY 탭에서 친구 초대 링크를 보내 친구를 맺으면\n여기서 바로 여행에 초대할 수 있어요."}
          </AppText>
        </Animated.View>
      ) : (
        friends.data.map((friend, i) => {
          const joined = joinedIds.has(friend.userId);
          const pending = pendingIds.has(friend.userId);
          const sending = invite.isPending && invite.variables?.userId === friend.userId;
          const label = joined ? "함께하는 중" : pending ? "초대됨" : sending ? "보내는 중" : "초대";
          const disabled = joined || pending || sending;
          return (
            <Animated.View key={friend.userId} entering={FadeInDown.delay(i * 40).springify()} style={styles.row}>
              <Avatar name={friend.nickname} tone={joined ? "mint" : "paleblue"} />
              <AppText variant="bold14" numberOfLines={1} style={styles.name}>
                {friend.nickname}
              </AppText>
              <PressableScale
                onPress={() => invite.mutate(friend)}
                disabled={disabled}
                haptic={disabled ? false : "tap"}
                style={[styles.action, disabled ? styles.actionDone : styles.actionReady]}
                accessibilityRole="button"
                accessibilityLabel={disabled ? `${friend.nickname}, ${label}` : `${friend.nickname}님 초대하기`}
                accessibilityState={{ disabled, busy: sending }}
              >
                <Animated.View key={label} entering={FadeIn.duration(200)}>
                  <AppText variant="small13Bold" color={disabled ? "muted" : "darkgreen"}>
                    {label}
                  </AppText>
                </Animated.View>
              </PressableScale>
            </Animated.View>
          );
        })
      )}
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  handle: { width: 36, height: 4, backgroundColor: colors.border },
  background: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadows.sheet },
  content: { paddingHorizontal: screenPadding, paddingTop: space[8], gap: space[12] },
  header: { gap: space[4], marginBottom: space[4] },
  state: { height: 200 },
  empty: { paddingVertical: space[32], gap: space[8] },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: space[12] },
  name: { flex: 1 },
  action: { minWidth: 72, height: sizes.touchTarget, paddingHorizontal: space[12], borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  actionReady: { backgroundColor: colors.mint },
  actionDone: { backgroundColor: colors.surface },
});
