import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { diffDays, formatLong, formatNights } from "@/lib/date";
import { secureImageUrl } from "@/lib/imageUrl";
import { colors, fonts, radius, space } from "@/theme";

import { Skeleton } from "./Skeleton";

type Props = {
  title: string | null;
  startDate: string;
  endDate: string;
  /** 카드 위 대표 사진 (D2a·D2b). undefined면 사진 영역 없음, null이면 기본 그림 */
  photoUrl?: string | null;
  /** 카드 아래 한 줄 ("수정 · 서현이 함께 기다리고 있어요.") */
  footer?: string | null;
};

/** 피그마 D1·D2 여행 요약 카드 — "강릉 여행 / 10월 17일 (토) – 10월 19일 (월) / 2박 3일" */
export function TripSummaryCard({ title, startDate, endDate, photoUrl, footer }: Props) {
  const nights = diffDays(startDate, endDate);
  const photo = secureImageUrl(photoUrl);
  return (
    <View style={styles.card} accessible accessibilityLabel={`${title ?? "여행"}, ${formatLong(startDate)}부터 ${formatLong(endDate)}까지, ${formatNights(nights)}${footer ? `. ${footer}` : ""}`}>
      {photoUrl !== undefined ? (
        <View style={styles.photo}>
          {photo ? (
            <Animated.View entering={FadeIn.duration(260)} style={StyleSheet.absoluteFill}>
              <Image source={{ uri: photo }} style={styles.photoImage} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
            </Animated.View>
          ) : (
            <Icons.PinDestination width={44} height={42} />
          )}
        </View>
      ) : null}
      <View style={styles.body}>
        {title ? (
          <AppText variant="taskTitle" numberOfLines={1}>
            {title}
          </AppText>
        ) : (
          <Skeleton width="40%" height={20} />
        )}
        <View style={styles.dates}>
          <AppText variant="small12" color="muted" style={styles.date}>
            {formatLong(startDate)}
          </AppText>
          <AppText variant="small12" color="muted">
            –
          </AppText>
          <AppText variant="small12" color="muted" style={styles.date}>
            {formatLong(endDate)}
          </AppText>
        </View>
        <AppText variant="small12" color="darkgreen" style={styles.nights}>
          {formatNights(nights)}
        </AppText>
        {footer ? (
          <AppText variant="small12" color="muted" style={styles.footer}>
            {footer}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: "hidden" },
  photo: { height: 194, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  photoImage: { width: "100%", height: "100%" },
  body: { padding: space[16], gap: space[4] },
  dates: { flexDirection: "row", alignItems: "center", gap: space[16] },
  date: { minWidth: 96 },
  nights: { fontFamily: fonts.bold },
  footer: { marginTop: space[8] },
});
