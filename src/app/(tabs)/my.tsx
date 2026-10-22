import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { toast } from "sonner-native";

import { LINK_BASE_URL, USE_MOCK } from "@/api/config";
import { authApi, friendApi } from "@/api/endpoints";
import { errorMessage } from "@/api/errors";
import { resetMockDb } from "@/api/mock/server";
import { queryKeys } from "@/api/queryKeys";
import { AppText, Button, PressableScale, Screen } from "@/components/ui";
import { PersonaCard, useMyPersona } from "@/features/home/PersonaCard";
import { MBTI_PROFILES } from "@/features/mbti/profiles";
import { Skeleton } from "@/features/trip/components/Skeleton";
import { useAuthStore } from "@/store/auth";
import { colors, motion, radius, screenPadding, sizes, space } from "@/theme";

const enter = (i: number) => FadeInDown.delay(motion.stagger * i).springify().damping(motion.spring.gentle.damping);
/** 친구 아바타는 네 명까지 보여 주고 나머지는 "···" */
const MAX_FRIEND_AVATARS = 4;

/** 초안 M1 · MY 메인 — 프로필, 나의 여행 성향, 함께 떠나는 친구, 메뉴 */
export default function MyScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const persona = useMyPersona();
  const friends = useQuery({ queryKey: queryKeys.friends, queryFn: friendApi.list });
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sharingLink, setSharingLink] = useState(false);

  /** 2-4 친구 초대 링크를 새로 받아 공유합니다 (원문 토큰은 발급 응답에서만 받을 수 있어요) */
  const shareFriendLink = async () => {
    if (sharingLink) return;
    setSharingLink(true);
    try {
      const link = await friendApi.issueLink();
      await Share.share({ message: `${user?.nickname ?? "친구"}님이 TriPin 친구 초대를 보냈어요. 친구가 되면 여행에 바로 초대할 수 있어요.
${LINK_BASE_URL}friend/${link.token}` });
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setSharingLink(false);
    }
  };

  const signOut = async (before?: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await before?.();
    } finally {
      queryClient.clear();
      useAuthStore.getState().signOut();
    }
  };

  const confirmLogout = () =>
    Alert.alert("로그아웃할까요?", undefined, [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: () => signOut(() => authApi.logout().catch(() => undefined)) },
    ]);

  const confirmReset = () =>
    Alert.alert("목업 데이터를 초기화할까요?", "가입한 계정·설문·여행이 모두 지워지고 로그아웃돼요.", [
      { text: "취소", style: "cancel" },
      { text: "초기화", style: "destructive", onPress: () => signOut(resetMockDb) },
    ]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([queryClient.invalidateQueries({ queryKey: queryKeys.friends }), queryClient.invalidateQueries({ queryKey: queryKeys.myOnboarding })]);
    setRefreshing(false);
  };

  const nickname = user?.nickname ?? "여행자";
  // 카카오로 가입한 소셜 전용 회원은 email이 없습니다.
  const bio = persona.type ? MBTI_PROFILES[persona.type].oneLiner : (user?.email ?? "카카오 계정으로 로그인 중");
  const friendList = friends.data ?? [];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[colors.green]} />}
      >
        <View style={styles.header}>
          <AppText variant="label" accessibilityRole="header">
            MY
          </AppText>
        </View>

        <Animated.View entering={enter(0)} style={styles.profile}>
          <View style={styles.avatar}>
            <AppText variant="cardTitle" color="darkgreen">
              {Array.from(nickname.trim())[0] ?? "?"}
            </AppText>
          </View>
          <View style={styles.profileTexts}>
            <AppText variant="title" numberOfLines={1}>
              {nickname}
            </AppText>
            <AppText variant="small12" color="muted" numberOfLines={2}>
              {bio}
            </AppText>
          </View>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <PersonaCard variant="my" />
        </Animated.View>

        <Animated.View entering={enter(2)} style={styles.section}>
          <AppText variant="cardTitle" accessibilityRole="header">
            함께 떠나는 친구
          </AppText>
          <View style={styles.friendsCard}>
            {friends.isPending ? (
              <>
                <Skeleton width="30%" height={18} />
                <Skeleton width="70%" height={44} rounded={22} />
              </>
            ) : friends.isError ? (
              <View style={styles.friendsError}>
                <AppText variant="small13" color="muted">
                  친구 목록을 불러오지 못했어요.
                </AppText>
                <Button label="다시 시도" variant="neutral" height={40} onPress={() => void friends.refetch()} />
              </View>
            ) : (
              <>
                <AppText variant="label">{`친구 ${friendList.length}명`}</AppText>
                {friendList.length === 0 ? (
                  <AppText variant="small13" color="muted">
                    친구 초대 링크를 수락한 친구가 여기에 모여요. 친구가 되면 여행에 바로 초대할 수 있어요.
                  </AppText>
                ) : (
                  <View style={styles.friendAvatars} accessible accessibilityLabel={`친구 ${friendList.map((f) => f.nickname).join(", ")}`}>
                    {friendList.slice(0, MAX_FRIEND_AVATARS).map((f, i) => (
                      <View key={f.userId} style={[styles.friendAvatar, i % 2 === 0 ? styles.friendMint : styles.friendBlue]}>
                        <AppText variant="label" color={i % 2 === 0 ? "darkgreen" : "blue"}>
                          {Array.from(f.nickname.trim())[0] ?? "?"}
                        </AppText>
                      </View>
                    ))}
                    {friendList.length > MAX_FRIEND_AVATARS ? (
                      <AppText variant="label" color="muted" style={styles.moreFriends}>
                        ···
                      </AppText>
                    ) : null}
                  </View>
                )}
                <Button label="친구 목록 보기" variant="secondary" height={48} onPress={() => router.push("/my/friends")} />
              </>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={enter(3)} style={styles.menu}>
          <MenuRow label="내 여행" hint="다가오는 여행과 지난 여행을 모두 봐요" href="/my/trips" />
          <MenuRow label="친구 관리" hint="친구 목록에서 친구를 찾거나 끊어요" href="/my/friends" />
          <MenuRow label="친구 초대 링크 보내기" hint="링크를 받은 친구가 수락하면 바로 친구가 돼요" onPress={() => void shareFriendLink()} disabled={sharingLink} />
          <MenuRow label="로그아웃" onPress={confirmLogout} disabled={busy} />
          {USE_MOCK ? <MenuRow label="목업 데이터 초기화" hint="EXPO_PUBLIC_API_MOCK=true 일 때만 보여요" onPress={confirmReset} disabled={busy} danger /> : null}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

type MenuRowProps = { label: string; hint?: string; href?: Href; onPress?: () => void; disabled?: boolean; danger?: boolean };

/** 초안 M1 하단 메뉴 — "프로필 편집 ›" 같은 글자 행 */
function MenuRow({ label, hint, href, onPress, disabled, danger }: MenuRowProps) {
  return (
    <PressableScale
      onPress={() => (href ? router.push(href) : onPress?.())}
      disabled={disabled}
      haptic={disabled ? false : "tap"}
      scaleTo={0.98}
      style={[styles.menuRow, disabled && styles.menuDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
    >
      <AppText variant="small13" color={danger ? undefined : "charcoal"} style={danger ? styles.danger : undefined}>
        {`${label} ›`}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingBottom: space[32], gap: space[24] },
  header: { height: sizes.appBar, justifyContent: "center" },
  profile: { flexDirection: "row", alignItems: "center", gap: space[16] },
  avatar: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  profileTexts: { flex: 1, gap: 2 },
  section: { gap: space[16] },
  friendsCard: { borderRadius: 20, backgroundColor: colors.surface, padding: space[16], gap: space[16] },
  friendsError: { gap: space[8] },
  friendAvatars: { flexDirection: "row", alignItems: "center", gap: space[12] },
  friendAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  friendMint: { backgroundColor: colors.mint },
  friendBlue: { backgroundColor: colors.paleblue },
  moreFriends: { letterSpacing: 2 },
  menu: { gap: space[4] },
  menuRow: { minHeight: 48, justifyContent: "center" },
  menuDisabled: { opacity: 0.5 },
  danger: { color: colors.danger },
});
