import { Image } from "expo-image";
import { useState } from "react";
import { Dimensions, FlatList, Modal, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Diary } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { formatRange } from "@/lib/date";
import { colors, motion, radius, screenPadding, space } from "@/theme";

import { SATISFACTION_LABELS } from "../constants";
import { StarRatingView } from "./StarRating";

const enter = (i: number) => FadeInDown.delay(motion.stagger * i).springify().damping(motion.spring.gentle.damping);
const GRID_GAP = 6;

/** 여행기 본문 — 내 여행기 보기·친구 여행기·공유 링크가 함께 씁니다. 스크롤은 화면이 감쌉니다. */
export function DiaryBody({ diary }: { diary: Diary }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const cover = diary.photos.find((p) => p.photoId === diary.coverPhotoId) ?? diary.photos[0];
  const gridSize = (Dimensions.get("window").width - screenPadding * 2 - GRID_GAP * 2) / 3;

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.hero}>
        {cover ? (
          <Image source={{ uri: cover.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessibilityLabel="대표 사진" />
        ) : (
          <View style={styles.heroEmpty}>
            <Icons.PinDestination width={44} height={42} />
          </View>
        )}
      </Animated.View>

      <View style={styles.body}>
        <Animated.View entering={enter(0)} style={styles.titleBlock}>
          {diary.status === "DRAFT" ? (
            <View style={styles.draftChip}>
              <AppText variant="caption" color="blue">
                초안 · 아직 나만 볼 수 있어요
              </AppText>
            </View>
          ) : null}
          <AppText variant="title" accessibilityRole="header">
            {diary.title}
          </AppText>
          <AppText variant="small13" color="muted">
            {[diary.courseTitle !== diary.title ? diary.courseTitle : null, formatRange(diary.visitedFrom, diary.visitedTo)].filter(Boolean).join(" · ")}
          </AppText>
        </Animated.View>

        {diary.satisfaction ? (
          <Animated.View entering={enter(1)} style={styles.satisfaction} accessible accessibilityLabel={`만족도 5점 중 ${diary.satisfaction}점`}>
            <StarRatingView value={diary.satisfaction} />
            <AppText variant="small13Medium" color="darkgreen">
              {SATISFACTION_LABELS[diary.satisfaction - 1]}
            </AppText>
          </Animated.View>
        ) : null}

        {diary.experienceTags.length > 0 ? (
          <Animated.View entering={enter(2)} style={styles.tags}>
            {diary.experienceTags.map((t) => (
              <View key={t} style={styles.tag}>
                <AppText variant="caption" color="darkgreen">{`#${t}`}</AppText>
              </View>
            ))}
          </Animated.View>
        ) : null}

        {diary.body ? (
          <Animated.View entering={enter(3)}>
            <AppText variant="body" style={styles.text}>
              {diary.body}
            </AppText>
          </Animated.View>
        ) : null}

        {diary.photos.length > 0 ? (
          <Animated.View entering={enter(4)} style={styles.grid}>
            {diary.photos.map((photo, i) => (
              <PressableScale key={photo.photoId} onPress={() => setViewerIndex(i)} scaleTo={0.96} accessibilityRole="imagebutton" accessibilityLabel={`사진 ${i + 1} 크게 보기`}>
                <Image source={{ uri: photo.thumbnailUrl }} style={[styles.gridImage, { width: gridSize, height: gridSize }]} contentFit="cover" transition={200} />
              </PressableScale>
            ))}
          </Animated.View>
        ) : null}
      </View>

      <PhotoViewer photos={diary.photos.map((p) => p.url)} index={viewerIndex} onClose={() => setViewerIndex(null)} />
    </View>
  );
}

function PhotoViewer({ photos, index, onClose }: { photos: string[]; index: number | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get("window");
  return (
    <Modal visible={index !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        {index !== null ? (
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            initialScrollIndex={index}
            getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(uri) => uri}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height }} contentFit="contain" />}
          />
        ) : null}
        <PressableScale onPress={onClose} style={[styles.viewerClose, { top: insets.top + space[8] }]} accessibilityRole="button" accessibilityLabel="사진 닫기">
          <Icons.Close width={22} height={22} />
        </PressableScale>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[16] },
  hero: { height: 240, backgroundColor: colors.mint },
  heroEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: screenPadding, gap: space[16] },
  titleBlock: { gap: space[4] },
  draftChip: { alignSelf: "flex-start", paddingHorizontal: space[8], paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.paleblue },
  satisfaction: { flexDirection: "row", alignItems: "center", gap: 6 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space[8] },
  tag: { paddingHorizontal: 10, paddingVertical: space[4], borderRadius: radius.sm, backgroundColor: colors.mint },
  text: { lineHeight: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  gridImage: { borderRadius: radius.sm, backgroundColor: colors.surface },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)" },
  viewerClose: { position: "absolute", right: space[16], width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.9)" },
});
