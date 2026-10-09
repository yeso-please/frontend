import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { colors, motion, radius, space } from "@/theme";

import { EMPHASIS_BORDER, TASK_SYMBOL_SIZE } from "../constants";
import { STATUS_BADGE, StatusBadge, type TaskState } from "./StatusBadge";
import { PeopleIcon } from "./TintIcons";

export type TaskKind = "survey" | "dates" | "invite";

type Props = {
  /** 등장 순서 (stagger) */
  index: number;
  /** "01" */
  step: string;
  title: string;
  kind: TaskKind;
  state: TaskState;
  /** 첫 줄. Complete 상태에선 darkgreen 요약, 그 외엔 charcoal 설명(줄바꿈 가능) */
  primary: string;
  /** 둘째 줄 (작은 muted 글씨) */
  secondary?: string;
  onPress: () => void;
  accessibilityHint?: string;
};

function SymbolIcon({ kind, state }: { kind: TaskKind; state: TaskState }) {
  if (state === "complete") return <Icons.CheckTask width={22} height={22} />;
  if (kind === "dates") return <Icons.CalendarTask width={22} height={22} />;
  return <PeopleIcon color={state === "current" ? colors.blue : colors.muted} />;
}

const SYMBOL_BG: Record<TaskState, string> = { complete: colors.mint, current: colors.white, pending: colors.surface };

/**
 * 피그마 TriPin/Preparation/Task Card (State=Complete / Current / Pending). 카드 전체가 터치 영역입니다.
 * Current 강조(paleblue 배경 + 1.5px blue 보더)는 위에 겹친 층의 투명도로 바꿔 상태 전환을 부드럽게 보여줍니다.
 */
export function TaskCard({ index, step, title, kind, state, primary, secondary, onPress, accessibilityHint }: Props) {
  const emphasis = useSharedValue(state === "current" ? 1 : 0);
  useEffect(() => {
    emphasis.set(withTiming(state === "current" ? 1 : 0, motion.timing.base));
  }, [state, emphasis]);
  const emphasisStyle = useAnimatedStyle(() => ({ opacity: emphasis.get() }));

  const complete = state === "complete";
  const current = state === "current";

  return (
    <Animated.View entering={FadeInDown.delay(index * motion.stagger).springify()}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${step}단계 ${title}, ${STATUS_BADGE[state].label}. ${primary.replace(/\n/g, " ")}`}
        accessibilityHint={accessibilityHint}
      >
        <Animated.View pointerEvents="none" style={[styles.emphasis, emphasisStyle]} />

        <View style={styles.header}>
          <AppText variant="caption" color={current ? "blue" : "muted"}>
            {step}
          </AppText>
          <AppText variant="taskTitle" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
          <StatusBadge state={state} />
        </View>

        <View style={styles.body}>
          <View style={styles.symbol}>
            <Animated.View key={`${kind}-${state}`} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={[styles.symbolFill, { backgroundColor: SYMBOL_BG[state] }]}>
              <SymbolIcon kind={kind} state={state} />
            </Animated.View>
          </View>

          <Animated.View key={`${state}-${primary}`} entering={FadeIn.duration(240)} style={styles.texts}>
            <AppText variant="small13" color={complete ? "darkgreen" : "charcoal"} numberOfLines={2}>
              {primary}
            </AppText>
            {secondary ? (
              <AppText variant="tiny11" color="muted" numberOfLines={1}>
                {secondary}
              </AppText>
            ) : null}
          </Animated.View>

          {current ? <Icons.ChevronRightBlue width={16} height={16} /> : <Icons.ChevronRight width={16} height={16} />}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[16],
    gap: space[8],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minHeight: 116,
  },
  // 바깥 1px 보더까지 덮도록 -1 만큼 넓힙니다.
  emphasis: {
    position: "absolute",
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: radius.lg,
    borderWidth: EMPHASIS_BORDER,
    borderColor: colors.blue,
    backgroundColor: colors.paleblue,
  },
  header: { flexDirection: "row", alignItems: "center", gap: space[8] },
  title: { flex: 1 },
  body: { flexDirection: "row", alignItems: "center", gap: space[12] },
  symbol: { width: TASK_SYMBOL_SIZE, height: TASK_SYMBOL_SIZE },
  symbolFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, gap: 2 },
});
