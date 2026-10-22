import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from "react-native-reanimated";

import type { HeroImage } from "@/api/types";
import { AppText } from "@/components/ui";
import { secureImageUrl } from "@/lib/imageUrl";
import { colors, radius } from "@/theme";

const KOREA_TERRAIN = require("@/assets/illustrations/korea-terrain.webp");

/** 피그마 B4 대표 사진 (0,98 · 390×218) */
export const HERO_HEIGHT = 218;

/** 공공누리 제1유형은 출처 표시가 이용 조건입니다 (attraction.md "지역 대표 사진"). */
function creditText(hero: HeroImage) {
  if (hero.attractionId != null) return `대표 관광지 사진${hero.sourceName ? ` · ${hero.sourceName}` : ""}`;
  return ["사진", hero.sourceName, hero.photographer ? `촬영 ${hero.photographer}` : null, hero.license].filter(Boolean).join(" · ");
}

type Props = { hero: HeroImage | null; name: string; scrollY: SharedValue<number> };

/** 대표 사진 + 출처. 스크롤하면 사진이 천천히 따라 올라가(패럴랙스) 깊이감을 줍니다. 사진이 없으면 지형 일러스트. */
export function RegionHero({ hero, name, scrollY }: Props) {
  const uri = secureImageUrl(hero?.url);
  const parallax = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, HERO_HEIGHT], [0, HERO_HEIGHT * 0.35], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-120, 0], [1.25, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={styles.frame}>
      <Animated.View style={[StyleSheet.absoluteFill, parallax]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={250}
            accessibilityLabel={`${name} 대표 사진`}
            placeholder={KOREA_TERRAIN}
            placeholderContentFit="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback]} accessible accessibilityLabel={`${name} 대표 사진이 아직 없어요`}>
            <Image source={KOREA_TERRAIN} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
        )}
      </Animated.View>
      {hero ? (
        <View style={styles.credit} accessibilityLabel={creditText(hero)}>
          <AppText variant="tiny11" color="white" numberOfLines={1}>
            {creditText(hero)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: HERO_HEIGHT, overflow: "hidden", backgroundColor: colors.surface },
  fallback: { backgroundColor: colors.mint },
  credit: {
    position: "absolute",
    right: 12,
    bottom: 10,
    maxWidth: "80%",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: "rgba(20, 41, 28, 0.55)",
  },
});
