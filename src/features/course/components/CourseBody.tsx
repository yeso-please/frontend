import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";

import type { Course, CourseItem, Transport } from "@/api/types";
import { AppText, PressableScale } from "@/components/ui";
import { colors, motion, radius, space } from "@/theme";

import { dayChangeSummary, latestChangeSentence } from "../format";
import { MealCard, PlaceCard, RemovedCard } from "./CourseCards";
import { DayTabs } from "./DayTabs";
import { type DragScroll, DraggableList, ROW_GAP } from "./DraggableList";
import { SegmentedTabs } from "./SegmentedTabs";
import { TasteBasisBox } from "./TasteBasisBox";

export type CourseTab = "all" | "changes";

type Props = {
  course: Course;
  transport: Transport;
  tab: CourseTab;
  onTabChange: (tab: CourseTab) => void;
  dayIndex: number;
  onDayChange: (dayIndex: number) => void;
  /** 드래그·편집 직후처럼 잠깐 바꿔 보여 줄 파란 줄 (없으면 최근 변경·요약) */
  statusOverride?: string | null;
  /** 편집 가능한 참여자 화면 (E1). 없으면 둘러보기(E4) */
  edit?: {
    scroll: DragScroll;
    onEditPlace: (itemId: string) => void;
    onPickMeal: (itemId: string) => void;
    onMove: (itemId: string, dayIndex: number, position: number) => void;
    onDragStart?: () => void;
    onRestore: (removalId: number) => void;
    restoringId?: number | null;
    onOpenMap: (dayIndex: number) => void;
  };
  /** 목록 아래 덧붙일 내용 (예: 코스 다시 만들기) */
  footer?: ReactNode;
};

/** 함께 만드는 코스 본문 — 취향 상자 · 전체 보기/변경 표시 · 일차 탭 · 상태 줄 · 카드 목록 (E1·E2·E4·E5~E8) */
export function CourseBody({ course, transport, tab, onTabChange, dayIndex, onDayChange, statusOverride, edit, footer }: Props) {
  const day = course.days.find((d) => d.dayIndex === dayIndex) ?? course.days[0];
  const dayChanges = course.changes?.days.find((d) => d.dayIndex === day?.dayIndex);
  const removed = (course.changes?.removed ?? []).filter((r) => r.dayIndex === day?.dayIndex);
  const latest = latestChangeSentence(course.changes?.latest ?? null);

  const status =
    statusOverride ??
    (tab === "changes"
      ? (dayChangeSummary(dayChanges) ?? "이 날은 아직 바뀐 장소가 없어요.")
      : (latest ?? "첫 추천 코스 · 아직 친구 변경이 반영되지 않았어요."));

  const renderItem = (item: CourseItem, handle: ReactNode | undefined) =>
    item.type === "ATTRACTION" ? (
      <PlaceCard item={item} transport={transport} handle={handle} onEdit={edit ? () => edit.onEditPlace(item.itemId) : undefined} />
    ) : (
      <MealCard item={item} transport={transport} handle={handle} onPick={edit ? () => edit.onPickMeal(item.itemId) : undefined} />
    );

  return (
    <View style={styles.wrap}>
      <TasteBasisBox course={course} />

      <SegmentedTabs
        accessibilityLabel="코스 보기 방식"
        options={[
          { value: "all", label: "전체 보기" },
          { value: "changes", label: "변경 표시" },
        ]}
        value={tab}
        onChange={onTabChange}
      />

      {course.days.length > 0 ? <DayTabs days={course.days} value={day?.dayIndex ?? 0} onChange={onDayChange} /> : null}

      <Animated.View key={status} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
        <AppText variant="small13Medium" color="blue" accessibilityLiveRegion="polite">
          {status}
        </AppText>
      </Animated.View>

      {edit ? (
        <View style={styles.hintRow}>
          <AppText variant="small12" color="muted" style={styles.hint}>
            오른쪽 핸들을 길게 눌러 하루 안에서 순서를 바꿔요.
          </AppText>
          <PressableScale onPress={() => edit.onOpenMap(day?.dayIndex ?? 0)} style={styles.mapButton} accessibilityRole="button" accessibilityLabel="이 날 코스를 지도로 보기">
            <AppText variant="small12" color="darkgreen">
              지도로 보기 ›
            </AppText>
          </PressableScale>
        </View>
      ) : null}

      {day ? (
        <Animated.View key={`day-${day.dayIndex}`} entering={FadeInDown.springify().damping(motion.spring.gentle.damping)} layout={LinearTransition}>
          {day.items.length === 0 ? (
            <View style={styles.emptyDay}>
              <AppText variant="small13" color="muted" align="center">
                이 날은 아직 장소가 없어요.
              </AppText>
            </View>
          ) : edit ? (
            <DraggableList
              items={day.items}
              keyOf={(item) => item.itemId}
              enabled
              scroll={edit.scroll}
              onDragStart={edit.onDragStart}
              onDrop={(itemId, position) => edit.onMove(itemId, day.dayIndex, position)}
              renderItem={renderItem}
            />
          ) : (
            day.items.map((item) => (
              <View key={item.itemId} style={styles.staticRow}>
                {renderItem(item, undefined)}
              </View>
            ))
          )}

          {tab === "changes" && removed.length > 0 ? (
            <Animated.View entering={FadeInDown} style={styles.removed}>
              {removed.map((r) => (
                <RemovedCard
                  key={r.removalId}
                  removal={r}
                  restoring={edit?.restoringId === r.removalId}
                  onRestore={edit ? () => edit.onRestore(r.removalId) : undefined}
                />
              ))}
              <AppText variant="small12" color="muted">
                제외된 장소는 전체 코스에서 보이지 않아요.
              </AppText>
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : (
        <View style={styles.emptyDay}>
          <AppText variant="small13" color="muted" align="center">
            아직 코스가 없어요.
          </AppText>
        </View>
      )}

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[16] },
  hintRow: { flexDirection: "row", alignItems: "center", gap: space[8], marginTop: -space[8] },
  hint: { flex: 1 },
  mapButton: { height: 32, paddingHorizontal: space[12], borderRadius: radius.pill, backgroundColor: colors.mint, justifyContent: "center" },
  staticRow: { marginBottom: ROW_GAP },
  removed: { gap: space[12] },
  emptyDay: { paddingVertical: space[32], borderRadius: radius.lg, backgroundColor: colors.surface },
});
