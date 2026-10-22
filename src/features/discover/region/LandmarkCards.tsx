import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import type { Landmark } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { secureImageUrl } from "@/lib/imageUrl";
import { colors, motion, radius, space } from "@/theme";

/**
 * B4 "{지역}에서 만나볼 순간" — 지역 카드 landmarks(최대 3곳, D13-2): 사진·이름·승인된 한 줄 소개.
 * 피그마는 아이콘 자리였지만 실제 관광지 사진이 있으면 사진을 보여 줍니다.
 */
export function LandmarkCards({ landmarks }: { landmarks: Landmark[] }) {
  return (
    <View style={styles.row}>
      {landmarks.slice(0, 3).map((landmark, i) => {
        const uri = secureImageUrl(landmark.thumbnailUrl);
        return (
          <Animated.View
            key={landmark.attractionId}
            entering={FadeInDown.delay(120 + motion.stagger * i).springify().damping(motion.spring.gentle.damping)}
            style={styles.card}
            accessible
            accessibilityLabel={`${landmark.name}${landmark.oneLine ? `, ${landmark.oneLine}` : ""}`}
          >
            <View style={styles.thumb}>
              {uri ? (
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : (
                <View style={styles.thumbEmpty}>
                  {i % 2 === 0 ? <Icons.PinBlue20 width={20} height={20} /> : <Icons.PinDarkgreen20 width={20} height={20} />}
                </View>
              )}
            </View>
            <AppText variant="small13Bold" numberOfLines={2}>
              {landmark.name}
            </AppText>
            {landmark.oneLine ? (
              <AppText variant="small12" color="muted" numberOfLines={3}>
                {landmark.oneLine}
              </AppText>
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space[8] },
  // 피그마 카드: surface, r12, 안쪽 12
  card: { flex: 1, padding: 10, gap: 6, borderRadius: radius.md, backgroundColor: colors.surface },
  thumb: { height: 72, borderRadius: 10, overflow: "hidden", backgroundColor: colors.border },
  thumbEmpty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
});
