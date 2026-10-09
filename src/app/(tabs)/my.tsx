import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { USE_MOCK } from "@/api/config";
import { authApi, onboardingApi } from "@/api/endpoints";
import { resetMockDb } from "@/api/mock/server";
import { queryKeys } from "@/api/queryKeys";
import { Icons } from "@/components/icons";
import { AppText, PressableScale, Screen } from "@/components/ui";
import { MbtiSummaryCard } from "@/features/mbti";
import { useAuthStore } from "@/store/auth";
import { useMbtiStore } from "@/store/mbti";
import { colors, motion, radius, screenPadding, sizes, space } from "@/theme";

const enter = (i: number) => FadeInDown.delay(motion.stagger * i).springify().damping(motion.spring.gentle.damping);

/** MY 탭 — 디자인 없음. 디자이너 메모 "MY → 친구 설정, 프로필, mbti 검사"에 맞춰 토큰만 맞춘 기본 화면입니다. */
export default function MyScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const tasteQuery = useQuery({ queryKey: queryKeys.myOnboarding, queryFn: onboardingApi.me });
  const [busy, setBusy] = useState(false);

  const signOut = async (before?: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await before?.();
    } finally {
      queryClient.clear();
      // 여행 MBTI 결과는 기기에만 저장되므로 다른 계정에 남지 않게 지웁니다
      useMbtiStore.getState().clear();
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

  const nickname = user?.nickname ?? "여행자";
  const profileText = tasteQuery.data?.submission?.profileText;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)} style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            MY
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.profile}>
          <View style={styles.avatar}>
            <AppText variant="cardTitle" color="darkgreen">
              {nickname.slice(0, 1)}
            </AppText>
          </View>
          <View style={styles.profileTexts}>
            <AppText variant="cardTitle" numberOfLines={1}>
              {`${nickname}님`}
            </AppText>
            {user?.email ? (
              <AppText variant="small13" color="muted" numberOfLines={1}>
                {user.email}
              </AppText>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={enter(2)} style={styles.section}>
          <SectionTitle>여행 MBTI</SectionTitle>
          <MbtiSummaryCard />
        </Animated.View>

        <Animated.View entering={enter(3)} style={styles.section}>
          <SectionTitle>여행 취향</SectionTitle>
          <View style={styles.group}>
            {profileText ? (
              <View style={styles.taste}>
                <AppText variant="small12" color="muted">
                  지금 반영된 취향
                </AppText>
                <AppText variant="bodyMedium15" color="darkgreen">
                  {profileText}
                </AppText>
              </View>
            ) : null}
            <Row label="여행 취향 다시 설정" description="여행 스타일·동기·좋아한 지역을 다시 골라요" href="/my/taste" />
          </View>
        </Animated.View>

        <Animated.View entering={enter(4)} style={styles.section}>
          <SectionTitle>계정</SectionTitle>
          <View style={styles.group}>
            <Row label="친구 관리 (준비 중)" disabled />
            <Divider />
            <Row label="로그아웃" onPress={confirmLogout} disabled={busy} />
          </View>
        </Animated.View>

        {USE_MOCK ? (
          <Animated.View entering={enter(5)} style={styles.section}>
            <SectionTitle>개발용</SectionTitle>
            <View style={styles.group}>
              <Row label="목업 데이터 초기화" description="EXPO_PUBLIC_API_MOCK=true 일 때만 보여요" onPress={confirmReset} disabled={busy} danger />
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <AppText variant="caption" color="muted" style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </AppText>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

type RowProps = {
  label: string;
  description?: string;
  href?: Href;
  onPress?: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function Row({ label, description, href, onPress, disabled, danger }: RowProps) {
  const handlePress = () => {
    if (href) router.push(href);
    else onPress?.();
  };
  return (
    <PressableScale
      onPress={handlePress}
      disabled={disabled}
      haptic={disabled ? false : "tap"}
      scaleTo={0.98}
      style={[styles.row, disabled && styles.rowDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ disabled: !!disabled }}
    >
      <View style={styles.rowTexts}>
        <AppText variant="bodyMedium15" style={danger ? styles.danger : undefined} color={disabled ? "muted" : "charcoal"}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="small12" color="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      {!disabled && href ? <Icons.ChevronRight width={16} height={16} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingBottom: space[32], gap: space[24] },
  header: { height: sizes.appBar + 8, justifyContent: "flex-end" },
  profile: { flexDirection: "row", alignItems: "center", gap: space[16] },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  profileTexts: { flex: 1, gap: 2 },
  section: { gap: space[8] },
  sectionTitle: { paddingHorizontal: space[4] },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, overflow: "hidden" },
  taste: { backgroundColor: colors.mint, paddingHorizontal: space[16], paddingVertical: space[12], gap: 2 },
  row: { minHeight: 56, paddingHorizontal: space[16], paddingVertical: space[8], flexDirection: "row", alignItems: "center", gap: space[12] },
  rowDisabled: { opacity: 0.6 },
  rowTexts: { flex: 1, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: space[16] },
  danger: { color: colors.danger },
});
