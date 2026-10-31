import { Image } from "expo-image";
import { ScrollView, StyleSheet, View } from "react-native";

import type { AttractionItem, Course } from "@/api/types";
import { AppText, PressableScale } from "@/components/ui";
import { secureImageUrl } from "@/lib/imageUrl";
import { colors, radius, screenPadding, space } from "@/theme";

import { CategoryGlyph } from "./CategoryGlyph";

const PHOTO = 96;

/**
 * 코스에 들어간 관광지 사진을 옆으로 넘겨 보는 줄 (요청서 #4 · 지역 상세 "만나볼 순간"과 같은 느낌).
 * 식사는 빼고 날짜·순서대로 둡니다. onOpen이 없으면(공유·비회원 화면) 누를 수 없습니다.
 */
export function CoursePhotoStrip({ course, onOpen }: { course: Course; onOpen?: (attractionId: number) => void }) {
  const multiDay = course.days.length > 1;
  const places = course.days.flatMap((d) =>
    d.items.filter((i): i is AttractionItem => i.type === "ATTRACTION").map((item) => ({ item, dayIndex: d.dayIndex })),
  );
  if (places.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.row} accessibilityLabel="코스 장소 사진">
      {places.map(({ item, dayIndex }) => {
        const uri = secureImageUrl(item.thumbnailUrl);
        return (
          <PressableScale
            key={item.itemId}
            onPress={() => onOpen?.(item.attractionId)}
            disabled={!onOpen}
            haptic={onOpen ? "tick" : false}
            scaleTo={0.96}
            style={styles.card}
            accessibilityRole={onOpen ? "button" : undefined}
            accessibilityLabel={`${multiDay ? `${dayIndex + 1}일차 ` : ""}${item.name}`}
            accessibilityHint={onOpen ? "장소 정보를 열어요" : undefined}
          >
            <View style={styles.photo}>
              {uri ? (
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={uri} />
              ) : (
                <CategoryGlyph kind={item.category} size={28} color={colors.blue} />
              )}
            </View>
            {multiDay ? (
              <AppText variant="badge" color="darkgreen">
                {`${dayIndex + 1}일차`}
              </AppText>
            ) : null}
            <AppText variant="small12" numberOfLines={1}>
              {item.name}
            </AppText>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // 화면 좌우 여백까지 끝에서 끝으로 넘기게 펼칩니다.
  strip: { marginHorizontal: -screenPadding },
  row: { paddingHorizontal: screenPadding, gap: space[8] },
  card: { width: PHOTO, gap: 2 },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.paleblue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
});
