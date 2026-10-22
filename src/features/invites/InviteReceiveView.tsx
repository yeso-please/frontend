import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icons } from "@/components/icons";
import { AppText, Button, Screen, TopBar } from "@/components/ui";
import { TripSummaryCard } from "@/features/trip/components/TripSummaryCard";
import { withEuro, withIGa } from "@/lib/josa";
import { colors, motion, radius, screenPadding, space } from "@/theme";

const enter = (i: number) => FadeInDown.delay(motion.stagger * i).springify().damping(motion.spring.gentle.damping);

type Action = { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; hint?: string };

type Props = {
  heading: string;
  subheading: string;
  tripTitle: string;
  startDate: string;
  endDate: string;
  photoUrl: string | null;
  /** 이미 함께하는 사람들 닉네임 */
  participants: string[];
  infoTitle: string;
  infoBody: string;
  primary: Action;
  secondary?: Action;
  /** 버튼 위 안내 (날짜 겹침 등) */
  notice?: ReactNode;
  /** 버튼 아래 작은 링크 (초대 거절, 로그인) */
  footerLink?: ReactNode;
};

/** 피그마 D2a · 회원 초대 수신 / D2b · 비회원 초대 수신 공통 모양 */
export function InviteReceiveView({ heading, subheading, tripTitle, startDate, endDate, photoUrl, participants, infoTitle, infoBody, primary, secondary, notice, footerLink }: Props) {
  const insets = useSafeAreaInsets();
  const waiting = participants.length > 0 ? `${withIGa(participants.join(" · "))} 함께 기다리고 있어요.` : null;
  return (
    <Screen>
      <TopBar title="여행 초대" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)} style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {heading}
          </AppText>
          <AppText variant="body" color="muted">
            {subheading}
          </AppText>
        </Animated.View>
        <Animated.View entering={enter(1)}>
          <TripSummaryCard title={tripTitle} startDate={startDate} endDate={endDate} photoUrl={photoUrl} footer={waiting} />
        </Animated.View>
        <Animated.View entering={enter(2)} style={styles.info}>
          <AppText variant="label" color="darkgreen">
            {infoTitle}
          </AppText>
          <AppText variant="small13" color="darkgreen">
            {infoBody}
          </AppText>
        </Animated.View>
        {notice}
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) + (footerLink ? 0 : 12) }]}>
        <Button
          label={primary.label}
          onPress={primary.onPress}
          loading={primary.loading}
          disabled={primary.disabled}
          accessibilityHint={primary.hint}
          rightIcon={<Icons.ArrowRight width={20} height={20} />}
        />
        {secondary ? (
          <Button label={secondary.label} variant="secondary" height={48} onPress={secondary.onPress} disabled={secondary.disabled} accessibilityHint={secondary.hint} />
        ) : null}
        {footerLink}
      </View>
    </Screen>
  );
}

/** "같이, 강릉으로\n떠나볼까요?" */
export const joinHeading = (regionLabel: string | null) => (regionLabel ? `같이, ${withEuro(regionLabel)}\n떠나볼까요?` : "같이,\n여행을 떠나볼까요?");

/** 정보 상자 본문 — 첫 코스는 초대자(만든 사람) 취향, 이후 내 취향을 더한다 */
export const firstCourseBody = (inviterNickname: string) => `첫 코스는 초대자 ${inviterNickname}님의 성향으로 만들고,\n이후 내 취향에 맞는 장소를 더할 수 있어요.`;

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[24], paddingBottom: space[24], gap: space[24] },
  intro: { gap: space[8] },
  info: { borderRadius: radius.lg, backgroundColor: colors.mint, padding: space[16], gap: space[8] },
  actions: { paddingTop: space[12], paddingHorizontal: screenPadding, gap: space[12], backgroundColor: colors.white },
});
