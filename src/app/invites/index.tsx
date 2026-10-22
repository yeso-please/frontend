import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import { RefreshControl, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import type { ReceivedInvite } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, EmptyView, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { useReceivedInvites } from "@/features/invites/useReceivedInvites";
import { formatDotRange, tripCardTitle } from "@/features/trip/lib";
import { diffDays, formatNights } from "@/lib/date";
import { secureImageUrl } from "@/lib/imageUrl";
import { colors, motion, radius, screenPadding, space } from "@/theme";

/** 알림 벨 → 받은 여행 초대 목록 (4-7). 피그마에 목록 화면은 없어 D2a 카드 톤에 맞춥니다. */
export default function ReceivedInvitesScreen() {
  const invites = useReceivedInvites();

  return (
    <Screen>
      <TopBar title="받은 초대" />
      {invites.isPending ? (
        <LoadingView />
      ) : invites.isError ? (
        <ErrorView error={invites.error} onRetry={() => void invites.refetch()} />
      ) : invites.data.length === 0 ? (
        <EmptyView title="받은 여행 초대가 없어요" description="친구가 여행에 초대하면 여기에서 확인할 수 있어요." />
      ) : (
        <FlashList
          data={invites.data}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={invites.isRefetching} onRefresh={() => void invites.refetch()} colors={[colors.green]} />}
          renderItem={({ item, index }) => <InviteRow invite={item} index={index} />}
        />
      )}
    </Screen>
  );
}

function InviteRow({ invite, index }: { invite: ReceivedInvite; index: number }) {
  const title = tripCardTitle(invite.trip.regionName, invite.trip.title);
  const photo = secureImageUrl(invite.trip.heroImageUrl);
  const dates = `${formatDotRange(invite.trip.startDate, invite.trip.endDate)} · ${formatNights(diffDays(invite.trip.startDate, invite.trip.endDate))}`;
  return (
    <Animated.View entering={FadeInDown.delay(index * motion.stagger).springify()}>
      <PressableScale
        onPress={() => router.push({ pathname: "/invites/[inviteId]", params: { inviteId: String(invite.id) } })}
        scaleTo={0.98}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${invite.inviter.nickname}님이 ${title}에 초대했어요, ${dates}`}
      >
        <View style={styles.thumb}>{photo ? <Image source={{ uri: photo }} style={styles.thumbImage} contentFit="cover" transition={200} /> : <Icons.PinDestination width={28} height={26} />}</View>
        <View style={styles.texts}>
          <AppText variant="small12" color="blue">{`${invite.inviter.nickname}님의 초대`}</AppText>
          <AppText variant="label" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="small12" color={invite.dateConflict ? "muted" : "darkgreen"}>
            {invite.dateConflict ? `${dates} · 내 여행과 날짜가 겹쳐요` : dates}
          </AppText>
        </View>
        <Icons.ChevronRight width={16} height={16} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[24] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    padding: space[12],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginBottom: space[12],
  },
  thumb: { width: 64, height: 64, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  thumbImage: { width: "100%", height: "100%" },
  texts: { flex: 1, gap: 2 },
});
