import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { friendApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { Friend } from "@/api/types";
import { AppText, Button, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { Avatar } from "@/features/trip/components/Avatar";
import { haptics } from "@/lib/haptics";
import { colors, fonts, radius, screenPadding, shadows, sizes, space } from "@/theme";

const renderBackdrop = (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />;

/** "2026-10-20T12:05:00" → "2026.10.20부터 친구" */
const sinceText = (since: string) => `${since.slice(0, 10).replaceAll("-", ".")}부터 친구`;

/**
 * 초안 M2 · 친구 목록. 백엔드는 다른 회원의 설문·MBTI를 주지 않아(2-9는 닉네임·친구가 된 날만) 성향 줄은 그리지 않습니다.
 * "···" → 친구 옵션 시트 → 친구 끊기 확인 (2-10).
 */
export default function FriendsScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const friends = useQuery({ queryKey: queryKeys.friends, queryFn: friendApi.list });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Friend | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);

  const remove = useMutation({
    mutationFn: (friend: Friend) => friendApi.remove(friend.userId),
    onMutate: async (friend) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.friends });
      const previous = queryClient.getQueryData<Friend[]>(queryKeys.friends);
      queryClient.setQueryData<Friend[]>(queryKeys.friends, (old) => old?.filter((f) => f.userId !== friend.userId));
      return { previous };
    },
    onSuccess: (_d, friend) => {
      haptics.confirm();
      toast(`${friend.nickname}님과 친구를 끊었어요`);
    },
    onError: (e, friend, ctx) => {
      haptics.reject();
      if (isApiError(e, "FRIEND_NOT_FOUND")) {
        toast(`${friend.nickname}님은 이미 친구 목록에 없어요`);
        return;
      }
      if (ctx?.previous) queryClient.setQueryData(queryKeys.friends, ctx.previous);
      toast(errorMessage(e));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.friends }),
  });

  const openOptions = (friend: Friend) => {
    setSelected(friend);
    sheetRef.current?.present();
  };

  const confirmDisconnect = () => {
    const friend = selected;
    sheetRef.current?.dismiss();
    if (!friend) return;
    Alert.alert(`${friend.nickname}님과 친구를 끊을까요?`, "서로 친구 목록에서 사라지고, 여행에 바로 초대할 수 없어요. 다시 친구가 되려면 새 초대 링크가 필요해요.", [
      { text: "취소", style: "cancel" },
      { text: "친구 끊기", style: "destructive", onPress: () => remove.mutate(friend) },
    ]);
  };

  const keyword = query.trim();
  const list = (friends.data ?? []).filter((f) => !keyword || f.nickname.includes(keyword));

  return (
    <Screen>
      <TopBar title="친구" />
      {friends.isPending ? (
        <LoadingView label="친구 목록을 불러오는 중이에요" />
      ) : friends.isError ? (
        <ErrorView error={friends.error} onRetry={() => void friends.refetch()} />
      ) : (
        <Animated.FlatList
          data={list}
          keyExtractor={(f) => String(f.userId)}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[24] }]}
          keyboardShouldPersistTaps="handled"
          itemLayoutAnimation={LinearTransition.springify()}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.search}>
                <AppText variant="body" color="muted">
                  ⌕
                </AppText>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="친구 이름 검색"
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                  returnKeyType="search"
                  accessibilityLabel="친구 이름 검색"
                />
              </View>
              <AppText variant="cardTitle" accessibilityRole="header">{`친구 ${friends.data.length}명`}</AppText>
            </View>
          }
          ListEmptyComponent={
            friends.data.length === 0 ? (
              <EmptyView title="아직 친구가 없어요" description="친구 초대 링크를 수락한 친구가 여기에 모여요." />
            ) : (
              <AppText variant="small13" color="muted" align="center" style={styles.noMatch}>{`"${keyword}"와 이름이 맞는 친구가 없어요`}</AppText>
            )
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).springify()} exiting={FadeOut.duration(160)} style={styles.row}>
              <Avatar name={item.nickname} size={44} />
              <View style={styles.texts} accessible accessibilityLabel={`${item.nickname}, ${sinceText(item.since)}`}>
                <AppText variant="label" numberOfLines={1}>
                  {item.nickname}
                </AppText>
                <AppText variant="small12" color="muted">
                  {sinceText(item.since)}
                </AppText>
              </View>
              <PressableScale onPress={() => openOptions(item)} haptic="tick" style={styles.more} accessibilityRole="button" accessibilityLabel={`${item.nickname}님 옵션`}>
                <AppText variant="label" color="muted" style={styles.moreText}>
                  ···
                </AppText>
              </PressableScale>
            </Animated.View>
          )}
        />
      )}

      <BottomSheetModal ref={sheetRef} enableDynamicSizing backdropComponent={renderBackdrop} handleIndicatorStyle={styles.handle} backgroundStyle={styles.sheet} onDismiss={() => setSelected(null)}>
        <BottomSheetView style={[styles.sheetContent, { paddingBottom: insets.bottom + space[24] }]}>
          <View style={styles.sheetHead}>
            {selected ? <Avatar name={selected.nickname} size={44} /> : null}
            <View style={styles.texts}>
              <AppText variant="label">{selected?.nickname ?? ""}</AppText>
              <AppText variant="small12" color="muted">
                {selected ? sinceText(selected.since) : ""}
              </AppText>
            </View>
          </View>
          <Button label="친구 끊기" variant="outline" labelColor="charcoal" onPress={confirmDisconnect} style={styles.disconnect} />
          <Button label="닫기" variant="secondary" height={48} onPress={() => sheetRef.current?.dismiss()} />
        </BottomSheetView>
      </BottomSheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[16] },
  header: { gap: space[24], marginBottom: space[16] },
  search: { height: 48, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: space[16], gap: space[8] },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.charcoal, paddingVertical: 0, includeFontPadding: false },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: space[12], marginBottom: space[16] },
  texts: { flex: 1, gap: 2 },
  more: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: "center", justifyContent: "center", marginRight: -space[8] },
  moreText: { letterSpacing: 2 },
  noMatch: { marginTop: space[24] },
  handle: { width: 36, height: 4, backgroundColor: colors.border },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadows.sheet },
  sheetContent: { paddingHorizontal: screenPadding, paddingTop: space[8], gap: space[12] },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: space[12], marginBottom: space[8] },
  disconnect: { borderColor: colors.danger },
});
