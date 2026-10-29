import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RefObject } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { shareUrl } from "@/api/config";
import { courseShareApi } from "@/api/endpoints";
import { errorMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, Button } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useSheetBackHandler } from "@/lib/useSheetBackHandler";
import { useAuthStore } from "@/store/auth";
import { colors, radius, screenPadding, shadows, space } from "@/theme";

import { SentLinkList } from "./SentLinkList";

const renderBackdrop = (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />;

type Props = { sheetRef: RefObject<BottomSheetModal | null>; tripId: number; title: string };

/**
 * 코스 공유 (4-9·4-10·4-11) — 여행에 참여하지 않은 사람에게 코스를 읽기 전용으로 보여 주는 링크를 보내고, 보낸 링크를 취소합니다.
 * 받는 사람은 로그인 없이 보고, 함께하는 사람 이름은 보이지 않습니다 (4-13).
 */
export function CourseShareSheet({ sheetRef, tripId, title }: Props) {
  const insets = useSafeAreaInsets();
  const back = useSheetBackHandler(sheetRef);
  return (
    <BottomSheetModal ref={sheetRef} onChange={back.onChange} snapPoints={["70%"]} enableDynamicSizing={false} backdropComponent={renderBackdrop} handleIndicatorStyle={styles.handle} backgroundStyle={styles.sheet}>
      <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[24] }]}>
        <CourseShareContent tripId={tripId} title={title} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

/** 시트가 열릴 때만 그려져 링크 목록도 그때 불러옵니다 */
function CourseShareContent({ tripId, title }: { tripId: number; title: string }) {
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const key = queryKeys.courseShareLinks(tripId);
  const links = useQuery({ queryKey: key, queryFn: () => courseShareApi.list(tripId) });

  const send = useMutation({
    mutationFn: async () => {
      const link = await courseShareApi.issue(tripId);
      await Share.share({ message: `${title}\nTriPin 코스를 공유했어요. 로그인 없이 볼 수 있어요.\n${shareUrl(`course/${link.token}`)}` });
    },
    onError: (e) => toast(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const revoke = useMutation({
    mutationFn: (linkId: number) => courseShareApi.revoke(tripId, linkId),
    onSuccess: () => {
      haptics.confirm();
      toast("공유 링크를 취소했어요");
    },
    onError: (e) => toast(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return (
    <>
      <View style={styles.head}>
        <AppText variant="cardTitle">코스 공유하기</AppText>
        <AppText variant="small13" color="muted">
          링크를 받은 사람은 로그인 없이 이 코스를 볼 수 있어요. 함께하는 사람의 이름은 보이지 않고, 코스를 고칠 수는 없어요.
        </AppText>
      </View>
      <Button label="공유 링크 보내기" loading={send.isPending} onPress={() => send.mutate()} />
      <View style={styles.listHead}>
        <AppText variant="bold14">보낸 공유 링크</AppText>
        <AppText variant="small12" color="muted">
          7일 동안 열려요
        </AppText>
      </View>
      {links.isPending ? (
        <AppText variant="small12" color="muted">
          불러오는 중이에요…
        </AppText>
      ) : links.isError ? (
        <AppText variant="small12" color="muted">
          {errorMessage(links.error)}
        </AppText>
      ) : (
        <SentLinkList
          links={links.data}
          detail={(l) => (l.createdBy.userId === myId ? null : `${l.createdBy.nickname}님이 보낸 링크`)}
          revokeMessage="이 링크로는 더 이상 코스를 볼 수 없어요. 이미 열어 둔 화면도 바로 막혀요."
          onRevoke={(l) => revoke.mutate(l.id)}
          revokingId={revoke.isPending ? (revoke.variables ?? null) : null}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  handle: { width: 38, height: 4, backgroundColor: "#D7DDD9" },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadows.sheet },
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], gap: space[16] },
  head: { gap: space[8] },
  listHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space[8], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space[16] },
});
