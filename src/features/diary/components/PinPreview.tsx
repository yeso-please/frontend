import { Image } from "expo-image";
import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";

import type { DiaryPhoto } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { colors, fonts } from "@/theme";

// 피그마 04 · 설정 "대표 사진 핀" — 348×211 지도 그림 위에 사진 핀 세 개(왼쪽 위·오른쪽·가운데 아래)와 아래 이름표.
const ART_W = 348;
const ART_H = 211;
const PIN = 45;
/** 피그마의 핀 중심 좌표 (348 폭 기준) */
const SPOTS = [
  { x: 77.5, y: 49.5 },
  { x: 261.5, y: 94.5 },
  { x: 173.5, y: 126.5 },
];

type Props = { title: string; photos: DiaryPhoto[]; coverPhotoId: number | null };

/** 여행기 사진이 지도에 핀으로 남는 모습을 미리 보여 줍니다. 대표 사진이 첫 핀이고 사진이 없으면 빈 핀입니다. */
export function PinPreview({ title, photos, coverPhotoId }: Props) {
  const [width, setWidth] = useState(0);
  const scale = width > 0 ? width / ART_W : 1;
  const cover = photos.find((p) => p.photoId === coverPhotoId);
  const ordered = cover ? [cover, ...photos.filter((p) => p !== cover)] : photos;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.card} onLayout={onLayout} accessible accessibilityLabel={`${title}, 사진 ${photos.length}장이 지도에 핀으로 남아요`}>
      {width > 0 ? (
        <View style={[styles.art, { transform: [{ scale }] }]}>
          <Icons.DiaryPinMap width={ART_W} height={ART_H} />
        </View>
      ) : null}
      {SPOTS.map((spot, i) => {
        const photo = ordered[i];
        if (!photo && i > 0) return null;
        return (
          <View key={i} style={[styles.pin, { left: spot.x * scale - PIN / 2, top: spot.y * scale - PIN / 2 }]}>
            <View style={styles.pinInner}>
              {photo ? <Image source={{ uri: photo.thumbnailUrl }} style={styles.pinPhoto} contentFit="cover" /> : null}
            </View>
          </View>
        );
      })}
      <View style={styles.label}>
        <Icons.PinGreen16 width={16} height={16} />
        <AppText variant="small12" numberOfLines={1} style={styles.labelTitle}>
          {title}
        </AppText>
        <AppText variant="badge" color="muted">{`사진 ${photos.length}장`}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { height: 213, borderRadius: 14, borderWidth: 1, borderColor: "#DBE9DF", backgroundColor: "#EEF8F2", overflow: "hidden" },
  art: { position: "absolute", left: 0, top: 0, width: ART_W, height: ART_H, transformOrigin: "left top" },
  // 물방울 핀: 45px 정사각형을 -45° 돌리고 왼쪽 아래 모서리만 뾰족하게, 사진은 반대로 45° 돌려 바로 세웁니다
  pin: {
    position: "absolute",
    width: PIN,
    height: PIN,
    padding: 3,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.green,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 3,
    transform: [{ rotate: "-45deg" }],
    elevation: 3,
    shadowColor: "#1C4229",
  },
  pinInner: { flex: 1, borderRadius: 8, overflow: "hidden", backgroundColor: colors.mint },
  pinPhoto: { width: "140%", height: "140%", marginLeft: "-20%", marginTop: "-20%", transform: [{ rotate: "45deg" }] },
  label: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 11,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.95)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  labelTitle: { flex: 1, fontFamily: fonts.bold },
});
