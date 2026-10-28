import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { toast } from "sonner-native";

import { shareUrl } from "@/api/config";
import { api } from "@/api/client";
import { diaryApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { Diary } from "@/api/types";
import { AppText, BottomCTA, Button, EmptyView, ErrorView, LoadingView, Screen, TopBar } from "@/components/ui";
import { ConfirmDialog } from "@/features/course/components/ConfirmDialog";
import { SentLinkList } from "@/features/share/SentLinkList";
import { haptics } from "@/lib/haptics";
import { screenPadding, space } from "@/theme";

import { DiaryBody } from "../components/DiaryBody";
import { useDiary, useInvalidateDiaries } from "../hooks";

/** 여행기 보기 (6-6) — 작성자면 수정·공유·삭제, 친구면 읽기만 */
export function DiaryScreen({ diaryId }: { diaryId: number }) {
  const diary = useDiary(diaryId);
  const queryClient = useQueryClient();
  const invalidate = useInvalidateDiaries();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = useMutation({
    mutationFn: () => diaryApi.remove(diaryId),
    onSuccess: () => {
      haptics.confirm();
      queryClient.removeQueries({ queryKey: queryKeys.diary(diaryId) });
      invalidate();
      toast("여행기를 지웠어요");
      setConfirmDelete(false);
      router.back();
    },
    onError: (e) => {
      haptics.reject();
      toast(errorMessage(e));
    },
  });

  // includeInTasteProfile은 작성자에게만 옵니다 (6-6). 링크 공유는 발행했고 공개 범위가 LINK일 때만 됩니다.
  const isAuthor = diary.data?.includeInTasteProfile !== undefined;
  const canShare = isAuthor && diary.data?.status === "PUBLISHED" && diary.data?.visibility === "LINK";
  const linksKey = queryKeys.diaryShareLinks(diaryId);
  const links = useQuery({ queryKey: linksKey, queryFn: () => diaryApi.shareLinks(diaryId), enabled: canShare });

  const share = useMutation({
    mutationFn: () => diaryApi.issueShareLink(diaryId),
    onSuccess: async (link) => {
      await Share.share({ message: `${diary.data?.title ?? "여행기"}\n${shareUrl(`diary-link/${link.token}`)}` });
    },
    onError: (e) => toast(isApiError(e, "DIARY_NOT_PUBLISHABLE") ? "발행하고 공개 범위를 '링크'로 바꾸면 공유할 수 있어요" : errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: linksKey }),
  });

  const revoke = useMutation({
    mutationFn: (linkId: number) => diaryApi.revokeShareLink(diaryId, linkId),
    onSuccess: () => {
      haptics.confirm();
      toast("공유 링크를 취소했어요");
    },
    onError: (e) => toast(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: linksKey }),
  });

  if (diary.isPending) {
    return (
      <Screen>
        <TopBar title="여행기" />
        <LoadingView />
      </Screen>
    );
  }
  if (diary.isError) {
    return (
      <Screen>
        <TopBar title="여행기" />
        {isApiError(diary.error, "DIARY_NOT_FOUND") ? (
          <EmptyView title="볼 수 없는 여행기예요" description="지워졌거나 공개 범위가 바뀌었을 수 있어요." />
        ) : (
          <ErrorView error={diary.error} onRetry={() => void diary.refetch()} />
        )}
      </Screen>
    );
  }

  const d = diary.data;

  return (
    <Screen>
      <TopBar title="여행기" />
      <ScrollView contentContainerStyle={styles.content}>
        <DiaryBody diary={d} />
        {isAuthor ? (
          <View style={styles.authorActions}>
            {canShare ? <Button label="공유 링크 보내기" variant="secondary" height={48} loading={share.isPending} onPress={() => share.mutate()} /> : null}
            {canShare && links.data && links.data.length > 0 ? (
              <View style={styles.links}>
                <AppText variant="bold14">보낸 공유 링크</AppText>
                <SentLinkList
                  links={links.data}
                  revokeMessage="이 링크로는 더 이상 여행기를 볼 수 없어요. 이미 열어 둔 화면도 바로 막혀요."
                  onRevoke={(l) => revoke.mutate(l.id)}
                  revokingId={revoke.isPending ? (revoke.variables ?? null) : null}
                />
              </View>
            ) : null}
            <Button label="여행기 지우기" variant="ghost" labelColor="danger" height={44} onPress={() => setConfirmDelete(true)} />
          </View>
        ) : null}
      </ScrollView>
      {isAuthor ? (
        <BottomCTA>
          <Button label={d.status === "DRAFT" ? "이어서 쓰기" : "수정하기"} onPress={() => router.push({ pathname: "/diary/[diaryId]/edit", params: { diaryId: String(diaryId) } })} />
        </BottomCTA>
      ) : null}
      <ConfirmDialog
        visible={confirmDelete}
        title="여행기를 지울까요?"
        body="사진과 공유 링크도 함께 지워지고 되돌릴 수 없어요."
        confirmLabel="지우기"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

/**
 * 공유 링크로 받은 여행기 (6-11 → 6-12). 로그인 없이 열립니다.
 * 6-11이 쿠키(diary_share_session)를 주고 303으로 6-12에 보내므로 fetch가 따라가 여행기를 받습니다.
 */
export function SharedDiaryScreen({ token }: { token: string }) {
  const diary = useQuery({
    queryKey: ["shared-diary", token],
    queryFn: () => api.get<Diary>(`/shared/diaries/${token}`, { auth: false }),
    retry: false,
  });
  return (
    <Screen>
      <TopBar title="여행기" onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      {diary.isPending ? (
        <LoadingView />
      ) : diary.isError ? (
        <EmptyView
          title="열 수 없는 링크예요"
          description={
            isApiError(diary.error, "DIARY_SHARE_LINK_EXPIRED") || isApiError(diary.error, "DIARY_SHARE_LINK_REVOKED")
              ? "기간이 지났거나 작성자가 공유를 멈춘 여행기예요."
              : "없는 링크이거나 지워진 여행기예요."
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <DiaryBody diary={diary.data} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[32] },
  authorActions: { paddingHorizontal: screenPadding, paddingTop: space[24], gap: space[8] },
  links: { gap: space[8], marginTop: space[8] },
});
