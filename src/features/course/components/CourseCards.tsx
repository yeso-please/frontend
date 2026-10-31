import { Image } from "expo-image";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import type { AttractionItem, CourseChanges, MealItem, Transport } from "@/api/types";
import { AppText, PressableScale } from "@/components/ui";
import { secureImageUrl } from "@/lib/imageUrl";
import { colors, radius, space } from "@/theme";

import { changeLabel, itemDescription, mealLabel, replacedLine } from "../format";
import { CATEGORY_LABEL, CategoryGlyph } from "./CategoryGlyph";
import { TravelTimes } from "./TravelTimes";

const THUMB = 72;

function Thumb({ url, kind, muted }: { url: string | null; kind: AttractionItem["category"] | "MEAL"; muted?: boolean }) {
  const src = secureImageUrl(url);
  return (
    <View style={[styles.thumb, muted && styles.thumbMuted]}>
      {src ? (
        <Image source={{ uri: src }} style={[styles.thumbImage, muted && styles.imageMuted]} contentFit="cover" transition={200} recyclingKey={src} />
      ) : (
        <CategoryGlyph kind={kind} size={28} color={muted ? colors.muted : colors.blue} />
      )}
    </View>
  );
}

function EditButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[styles.editButton, styles.flex]} accessibilityRole="button" accessibilityLabel={label}>
      <AppText variant="small13Medium" color="blue">
        {`${label} ›`}
      </AppText>
    </PressableScale>
  );
}

type PlaceCardProps = {
  item: AttractionItem;
  /** 앞 지점 이동 시간의 기본 강조 수단 */
  transport: Transport;
  /** 편집 가능한 참여자 화면이면 "장소 편집" 버튼을 보여 줍니다 */
  onEdit?: () => void;
  /** 회원 화면이면 "상세보기"(7-4 시트). 공유·비회원 화면에는 없습니다 */
  onDetail?: () => void;
  /** 드래그 핸들(편집 화면에서만) */
  handle?: ReactNode;
};

/** 코스 관광지 카드 (초안 E1: 라벨 · 썸네일 · 이름 · 이동 시간 · 한 줄 소개 · 상세보기 · 장소 편집) */
export function PlaceCard({ item, transport, onEdit, onDetail, handle }: PlaceCardProps) {
  const label = changeLabel(item);
  const replaced = replacedLine(item);
  const description = itemDescription(item);
  return (
    <View style={styles.card}>
      <AppText variant="small12" color={label.tone === "base" ? "darkgreen" : "blue"} style={styles.label}>
        {label.text}
      </AppText>
      <View style={styles.main}>
        {onDetail ? (
          <PressableScale onPress={onDetail} haptic="tick" scaleTo={0.96} accessibilityRole="button" accessibilityLabel={`${item.name} 상세보기`}>
            <Thumb url={item.thumbnailUrl} kind={item.category} />
          </PressableScale>
        ) : (
          <Thumb url={item.thumbnailUrl} kind={item.category} />
        )}
        <View style={styles.texts}>
          <AppText variant="cardTitle" numberOfLines={2} onPress={onDetail} suppressHighlighting>
            {item.name}
          </AppText>
          <TravelTimes leg={item.travelFromPrevious} primary={transport} />
        </View>
        {handle}
      </View>
      {replaced ? (
        <AppText variant="small12" color="muted">
          {replaced}
          {item.change.note ? ` · "${item.change.note}"` : ""}
        </AppText>
      ) : null}
      {description ? (
        <AppText variant="small13" color="charcoal" numberOfLines={3}>
          {description}
        </AppText>
      ) : (
        <AppText variant="small12" color="muted">
          {CATEGORY_LABEL[item.category]}
        </AppText>
      )}
      {onDetail || onEdit ? (
        <View style={styles.actions}>
          {onDetail ? <EditButton label="상세보기" onPress={onDetail} /> : null}
          {onEdit ? <EditButton label="장소 편집" onPress={onEdit} /> : null}
        </View>
      ) : null}
    </View>
  );
}

type MealCardProps = {
  item: MealItem;
  transport: Transport;
  onPick?: () => void;
  handle?: ReactNode;
};

/** 식사 카드 (D6 — 디자인에 추가). 식당이 없으면 "미정" */
export function MealCard({ item, transport, onPick, handle }: MealCardProps) {
  const restaurant = item.restaurant;
  return (
    <View style={[styles.card, styles.mealCard]}>
      <AppText variant="small12" color="darkgreen" style={styles.label}>
        {mealLabel(item.meal)}
      </AppText>
      <View style={styles.main}>
        <Thumb url={restaurant?.imageUrl ?? null} kind="MEAL" />
        <View style={styles.texts}>
          <AppText variant="label" numberOfLines={2} color={restaurant ? "charcoal" : "muted"}>
            {restaurant?.name ?? "식당 미정"}
          </AppText>
          {restaurant ? (
            <TravelTimes leg={item.travelFromPrevious} primary={transport} firstLabel="앞 장소 근처 식당" />
          ) : (
            <AppText variant="small13" color="muted">
              앞 장소 근처에서 골라요
            </AppText>
          )}
        </View>
        {handle}
      </View>
      {restaurant?.representativeMenu ? (
        <AppText variant="small13" color="charcoal">{`대표 메뉴 · ${restaurant.representativeMenu}`}</AppText>
      ) : null}
      {onPick ? (
        <View style={styles.actions}>
          <EditButton label={restaurant ? "식당 바꾸기" : "식당 고르기"} onPress={onPick} />
        </View>
      ) : null}
    </View>
  );
}

type Removal = CourseChanges["removed"][number];

/** 변경 표시 탭의 제외된 장소 (E2 "서현 제외 · 반영 완료") */
export function RemovedCard({ removal, onRestore, restoring }: { removal: Removal; onRestore?: () => void; restoring?: boolean }) {
  const who = removal.removedBy?.nickname;
  return (
    <View style={[styles.card, styles.removedCard]} accessibilityLabel={`${removal.name}, ${who ? `${who}님이 ` : ""}제외한 장소`}>
      <View style={styles.removedChip}>
        <AppText variant="small12" color="muted">
          {`${who ? `${who} ` : ""}제외 · 반영 완료`}
        </AppText>
      </View>
      <View style={styles.main}>
        <Thumb url={null} kind="ETC" muted />
        <View style={styles.texts}>
          <AppText variant="cardTitle" color="muted" numberOfLines={2}>
            {removal.name}
          </AppText>
          <AppText variant="small13" color="muted">
            {removal.origin === "BASE" ? "기본 추천에서 제외된 장소" : "추가했다가 제외된 장소"}
          </AppText>
        </View>
      </View>
      {removal.note ? (
        <AppText variant="small13" color="muted">
          {removal.note}
        </AppText>
      ) : null}
      {onRestore ? (
        <PressableScale onPress={onRestore} disabled={restoring} style={styles.restore} accessibilityRole="button" accessibilityLabel={`${removal.name} 다시 넣기`}>
          <AppText variant="small13Medium" color="blue">
            {restoring ? "다시 넣는 중…" : "다시 넣기"}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[16],
    gap: space[8],
  },
  mealCard: { backgroundColor: colors.white },
  removedCard: { backgroundColor: colors.surface },
  label: { marginBottom: -2 },
  main: { flexDirection: "row", alignItems: "center", gap: space[12] },
  texts: { flex: 1, gap: space[4] },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    backgroundColor: colors.paleblue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbMuted: { backgroundColor: colors.border },
  thumbImage: { width: THUMB, height: THUMB },
  imageMuted: { opacity: 0.5 },
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: space[8], marginTop: space[4] },
  editButton: { height: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  removedChip: { alignSelf: "flex-start", paddingHorizontal: space[8], paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.border },
  restore: { alignSelf: "center", paddingHorizontal: space[16], height: 36, justifyContent: "center" },
});
