import { StyleSheet, View } from "react-native";
import { Directions, Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeInLeft, FadeInRight, FadeOut, LayoutAnimationConfig, ZoomIn } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { formatLong, parseYmd } from "@/lib/date";
import { colors, motion, radius, sizes, space } from "@/theme";

import { CALENDAR_CELL_HEIGHT } from "../constants";
import { buildMonthGrid, formatMonthTitle } from "../lib";

/** past: 오늘 이전·오늘 / blocked: 내 다른 여행 / overLimit: 최대 일수 밖 / available: 고를 수 있음 */
export type DayStatus = "past" | "blocked" | "overLimit" | "available";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Props = {
  monthId: string;
  /** 달 바뀜 방향 (첫 그림은 0 → 등장 애니메이션 없음) */
  direction: -1 | 0 | 1;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  start: string | null;
  end: string | null;
  today: string;
  statusOf: (ymd: string) => DayStatus;
  onDayPress: (ymd: string) => void;
  /** 여행을 만든 뒤에는 날짜를 바꿀 수 없어 보기만 합니다 */
  readOnly?: boolean;
};

/**
 * 피그마 TriPin/Calendar (398:464) — 일요일 시작, 7열, 셀 높이 44.
 * flash-calendar 대신 직접 그립니다: 셀별 스프링 등장·기간 띠 페이드, 비활성 사유(지난 날/다른 여행/최대 일수)별 표시,
 * 한국어 접근성 라벨이 필요해서입니다.
 */
export function MonthCalendar({ monthId, direction, canPrev, canNext, onPrev, onNext, start, end, today, statusOf, onDayPress, readOnly }: Props) {
  const weeks = buildMonthGrid(monthId);
  const hasSpan = !!start && !!end && start !== end;

  // 좌우로 휙 넘기면 달을 바꿉니다.
  const swipe = Gesture.Race(
    Gesture.Fling()
      .direction(Directions.LEFT)
      .runOnJS(true)
      .onEnd((_e, success) => {
        if (success && canNext) onNext();
      }),
    Gesture.Fling()
      .direction(Directions.RIGHT)
      .runOnJS(true)
      .onEnd((_e, success) => {
        if (success && canPrev) onPrev();
      }),
  );

  const entering = direction === 0 ? undefined : (direction > 0 ? FadeInRight : FadeInLeft).duration(220);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AppText variant="month" accessibilityRole="header">
          {formatMonthTitle(monthId)}
        </AppText>
        <View style={styles.nav}>
          <PressableScale onPress={onPrev} disabled={!canPrev} haptic="tick" accessibilityRole="button" accessibilityLabel="이전 달" accessibilityState={{ disabled: !canPrev }} style={[styles.navButton, !canPrev && styles.navDisabled]}>
            <Icons.MonthPrev width={20} height={20} />
          </PressableScale>
          <PressableScale onPress={onNext} disabled={!canNext} haptic="tick" accessibilityRole="button" accessibilityLabel="다음 달" accessibilityState={{ disabled: !canNext }} style={[styles.navButton, !canNext && styles.navDisabled]}>
            <Icons.MonthNext width={20} height={20} />
          </PressableScale>
        </View>
      </View>

      <View style={styles.weekHeader} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {WEEKDAYS.map((w) => (
          <AppText key={w} variant="caption" color="muted" align="center" style={styles.weekday}>
            {w}
          </AppText>
        ))}
      </View>

      <GestureDetector gesture={swipe}>
        <Animated.View key={monthId} entering={entering}>
          {/* 달이 바뀌어 새로 그릴 때는 셀 안 선택 표시의 등장 애니메이션을 건너뜁니다. */}
          <LayoutAnimationConfig skipEntering>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.week}>
                {week.map((ymd, di) =>
                  ymd ? (
                    <DayCell
                      key={ymd}
                      ymd={ymd}
                      status={statusOf(ymd)}
                      isStart={ymd === start}
                      isEnd={ymd === end}
                      inRange={!!start && !!end && ymd > start && ymd < end}
                      hasSpan={hasSpan}
                      isToday={ymd === today}
                      readOnly={!!readOnly}
                      onPress={onDayPress}
                    />
                  ) : (
                    <View key={`empty-${di}`} style={styles.cell} />
                  ),
                )}
              </View>
            ))}
          </LayoutAnimationConfig>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

type DayCellProps = {
  ymd: string;
  status: DayStatus;
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
  hasSpan: boolean;
  isToday: boolean;
  readOnly: boolean;
  onPress: (ymd: string) => void;
};

const STATUS_LABEL: Record<DayStatus, string> = {
  past: ", 고를 수 없는 날",
  blocked: ", 다른 여행이 있는 날",
  overLimit: ", 최대 일정을 넘는 날",
  available: "",
};

/** 피그마 Date cell — Default / Selected(green r12) / In range(mint, 모서리 없음) / Past(muted) */
function DayCell({ ymd, status, isStart, isEnd, inRange, hasSpan, isToday, readOnly, onPress }: DayCellProps) {
  const endpoint = isStart || isEnd;
  const selected = endpoint || inRange;
  const day = parseYmd(ymd).getDate();
  const textColor = endpoint || inRange ? "charcoal" : status === "available" ? "charcoal" : "muted";

  const roleLabel = isStart && isEnd ? ", 당일 여행" : isStart ? ", 시작일" : isEnd ? ", 종료일" : inRange ? ", 여행 기간" : "";

  return (
    <PressableScale
      onPress={() => onPress(ymd)}
      disabled={readOnly || status === "past"}
      haptic={false}
      scaleTo={0.92}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityLabel={`${formatLong(ymd)}${roleLabel}${selected ? "" : STATUS_LABEL[status]}`}
      accessibilityState={{ selected, disabled: status !== "available" && !selected }}
    >
      {inRange ? <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} style={styles.band} /> : null}
      {isStart && hasSpan ? <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} style={[styles.halfBand, styles.halfRight]} /> : null}
      {isEnd && hasSpan ? <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} style={[styles.halfBand, styles.halfLeft]} /> : null}
      {endpoint ? (
        <Animated.View
          entering={ZoomIn.springify().damping(motion.spring.bouncy.damping + 4).stiffness(motion.spring.bouncy.stiffness)}
          exiting={FadeOut.duration(140)}
          style={styles.endpoint}
        />
      ) : null}
      <AppText
        variant="bodyMedium15"
        color={textColor}
        style={[status === "blocked" && !selected && styles.strike, status === "overLimit" && !selected && styles.faint]}
      >
        {day}
      </AppText>
      {isToday ? <View style={styles.todayDot} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[8] },
  header: { height: sizes.touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nav: { flexDirection: "row", marginRight: -space[12] },
  navButton: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: "center", justifyContent: "center" },
  navDisabled: { opacity: 0.3 },
  weekHeader: { flexDirection: "row", height: 24, alignItems: "center" },
  weekday: { flex: 1 },
  week: { flexDirection: "row" },
  cell: { flex: 1, height: CALENDAR_CELL_HEIGHT, alignItems: "center", justifyContent: "center" },
  band: { ...StyleSheet.absoluteFill, backgroundColor: colors.mint },
  halfBand: { position: "absolute", top: 0, bottom: 0, width: "50%", backgroundColor: colors.mint },
  halfRight: { right: 0 },
  halfLeft: { left: 0 },
  endpoint: { ...StyleSheet.absoluteFill, borderRadius: radius.md, backgroundColor: colors.green },
  strike: { textDecorationLine: "line-through" },
  faint: { opacity: 0.45 },
  todayDot: { position: "absolute", bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.muted },
});
