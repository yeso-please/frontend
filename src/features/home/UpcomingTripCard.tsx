import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { regionApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { TripSummary } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, Button } from "@/components/ui";
import { formatDotRange, tripCardTitle } from "@/features/trip/lib";
import { PREP_STEP_LABEL, type PrepStep, prepStepHref } from "@/features/trip/prepStep";
import { formatNights } from "@/lib/date";
import { secureImageUrl } from "@/lib/imageUrl";
import { colors, fonts, radius, space } from "@/theme";

const THUMB = 80;
const AVATAR = 32;
/** 동행 아바타는 두 명까지 보여 주고 나머지는 "+n" */
const MAX_AVATARS = 2;
const CARD_STALE_MS = 60 * 60_000;

type Props = { trip: TripSummary; step: PrepStep; myUserId: number | null; width: number };

/** 피그마 A1 · 홈 "준비 중인 여행" 카드 */
export function UpcomingTripCard({ trip, step, myUserId, width }: Props) {
  const card = useQuery({
    queryKey: queryKeys.regionCard(trip.regionSigCd ?? ""),
    queryFn: () => regionApi.card(trip.regionSigCd as string),
    enabled: !!trip.regionSigCd,
    staleTime: CARD_STALE_MS,
  });
  const photo = secureImageUrl(card.data?.heroImage?.url);
  const title = tripCardTitle(trip.regionName, trip.title);
  const dates = `${formatDotRange(trip.startDate, trip.endDate)} · ${formatNights(trip.nights)}`;

  // 나를 맨 앞에 둡니다.
  const travelers = [...trip.participants].sort((a, b) => (a.userId === myUserId ? -1 : b.userId === myUserId ? 1 : 0));
  const shown = travelers.slice(0, MAX_AVATARS);
  const more = travelers.length - shown.length;

  return (
    <View style={[styles.card, { width }]} accessible={false}>
      <View style={styles.top}>
        <View style={styles.texts} accessible accessibilityLabel={`준비 중인 여행, ${title}, ${dates}`}>
          <AppText variant="caption" color="darkgreen">
            준비 중인 여행
          </AppText>
          <AppText variant="cardTitle" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
          <AppText variant="small13" color="darkgreen">
            {dates}
          </AppText>
        </View>
        <View style={styles.thumb}>
          {photo ? (
            <Animated.View entering={FadeIn.duration(260)} style={StyleSheet.absoluteFill}>
              <Image source={{ uri: photo }} style={styles.thumbImage} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
            </Animated.View>
          ) : (
            <Icons.PinDestination width={30} height={28} />
          )}
        </View>
      </View>

      <View style={styles.middle}>
        <View style={styles.statusChip} accessible accessibilityLabel={`지금 단계, ${PREP_STEP_LABEL[step]}`}>
          <AppText variant="small13Medium" color={step === "done" ? "darkgreen" : "blue"} numberOfLines={1}>
            {PREP_STEP_LABEL[step]}
          </AppText>
        </View>
        <View style={styles.avatars} accessible accessibilityLabel={`함께하는 여행자 ${travelers.length}명`}>
          {shown.map((p, i) => (
            <View key={p.userId} style={[styles.avatar, i === 0 ? styles.avatarMine : styles.avatarOther]}>
              <AppText variant="small13Bold" color={i === 0 ? "white" : "charcoal"}>
                {Array.from(p.nickname.trim())[0] ?? "?"}
              </AppText>
            </View>
          ))}
          {more > 0 ? (
            <View style={[styles.avatar, styles.avatarOther]}>
              <AppText variant="caption" style={styles.more}>{`+${more}`}</AppText>
            </View>
          ) : null}
        </View>
      </View>

      <Button
        label="이어서 준비하기"
        onPress={() => router.push(prepStepHref(trip.tripId, step))}
        rightIcon={<Icons.ArrowRight width={20} height={20} />}
        accessibilityHint={`${title}의 다음 준비 단계로 이동해요`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.mint, borderRadius: 20, padding: space[16], gap: space[16] },
  top: { flexDirection: "row", gap: space[12] },
  texts: { flex: 1, gap: 2, paddingTop: 2 },
  title: { fontSize: 22, lineHeight: 32 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: { width: "100%", height: "100%" },
  middle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[12] },
  statusChip: {
    flexShrink: 1,
    minWidth: 120,
    height: 32,
    paddingHorizontal: space[12],
    borderRadius: radius.md,
    backgroundColor: colors.white,
    justifyContent: "center",
  },
  avatars: { flexDirection: "row", gap: space[4] },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: "center", justifyContent: "center" },
  avatarMine: { backgroundColor: colors.green },
  avatarOther: { backgroundColor: colors.white },
  more: { fontFamily: fonts.bold, color: colors.charcoal },
});
