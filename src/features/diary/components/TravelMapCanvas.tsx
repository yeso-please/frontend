import { Image } from "expo-image";
import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import type { TravelMapPin } from "@/api/types";
import { AppText, PressableScale } from "@/components/ui";
import { MAP_IMAGE } from "@/lib/mapProjection";
import { colors, motion, radius, shadows } from "@/theme";

import { PIN, placePins, POINTER } from "../lib";

const KOREA_TERRAIN = require("@/assets/illustrations/korea-terrain.webp");

type Props = {
  pins: TravelMapPin[];
  onPinPress: (pin: TravelMapPin) => void;
};

/**
 * 발표 자료 "나의 여행 지도" — 여행 탭과 같은 3D 지형 지도 위에 여행기 대표 사진을 핀으로 꽂습니다.
 * 핀 위치는 대표 사진 위치, 없으면 지역 중심입니다 (6-7). 지도는 대략 그 지역을 가리키는 용도입니다.
 */
export function TravelMapCanvas({ pins, onPinPress }: Props) {
  const [width, setWidth] = useState(0);
  const height = (width * MAP_IMAGE.height) / MAP_IMAGE.width;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const placed = width > 0 ? placePins(pins, width, height) : [];

  return (
    <View onLayout={onLayout} style={[styles.wrap, { height: height || undefined }]} accessibilityLabel={`나의 여행 지도, 기록 ${pins.length}곳`}>
      {width > 0 ? <Image source={KOREA_TERRAIN} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
      {placed.map(({ pin, left, top }, i) => (
        <Animated.View
          key={pin.diaryId}
          entering={ZoomIn.delay(120 + i * motion.stagger).springify().damping(motion.spring.bouncy.damping)}
          style={[styles.pinWrap, { left, top }]}
        >
          <PressableScale
            onPress={() => onPinPress(pin)}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel={`${pin.title}, ${pin.regionName ?? "지역 미정"}, ${pin.visitedAt}`}
          >
            <View style={styles.photo}>
              {pin.coverPhotoUrl ? (
                <Image source={{ uri: pin.coverPhotoUrl }} style={styles.photoImage} contentFit="cover" transition={200} />
              ) : (
                <View style={styles.placeholder}>
                  <AppText variant="small13Bold" color="darkgreen">
                    {(pin.regionName ?? pin.title).split(" ").pop()?.slice(0, 2)}
                  </AppText>
                </View>
              )}
              {pin.status === "DRAFT" ? (
                <View style={styles.draft}>
                  <AppText variant="badge" color="white">
                    초안
                  </AppText>
                </View>
              ) : null}
            </View>
            <View style={styles.pointer} />
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", borderRadius: radius.xl, backgroundColor: colors.mint, overflow: "hidden" },
  pinWrap: { position: "absolute", width: PIN, alignItems: "center" },
  photo: {
    width: PIN,
    height: PIN,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.white,
    overflow: "hidden",
    ...shadows.label,
  },
  photoImage: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
  draft: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", backgroundColor: "rgba(32,37,32,0.6)" },
  pointer: {
    alignSelf: "center",
    width: 0,
    height: 0,
    borderLeftWidth: POINTER,
    borderRightWidth: POINTER,
    borderTopWidth: POINTER,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.white,
  },
});
