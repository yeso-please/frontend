import { type ReactNode, useLayoutEffect, useRef } from "react";
import { type LayoutChangeEvent, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  type AnimatedRef,
  measure,
  scrollTo,
  type SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { haptics } from "@/lib/haptics";
import { colors, motion, radius, shadows } from "@/theme";

// E5~E8 카드 들어올리기 → 놓을 위치 미리보기(파란 선) → 순서 변경.
// 핸들을 길게 누르면 카드가 떠오르고, 다른 카드가 자리를 비켜 주며, 화면 끝에 닿으면 페이지가 저절로 스크롤됩니다.

export const ROW_GAP = 16;
/** 들어올린 카드 그림자를 되돌리는 값 (안드로이드 elevation, iOS boxShadow) */
const NO_SHADOW = Platform.OS === "android" ? { elevation: 0 } : { boxShadow: "none" };
const EDGE = 96;
const MAX_SPEED = 14;
const LONG_PRESS_MS = 220;

export type DragScroll = {
  ref: AnimatedRef<Animated.ScrollView>;
  /** 현재 스크롤 위치 (화면의 onScroll이 갱신) */
  offset: SharedValue<number>;
  contentHeight: SharedValue<number>;
};

type Props<T> = {
  items: T[];
  keyOf: (item: T) => string;
  /** handle은 편집 가능할 때만 넘어옵니다. 카드 오른쪽에 놓으세요 */
  renderItem: (item: T, handle: ReactNode | undefined) => ReactNode;
  enabled: boolean;
  scroll: DragScroll;
  onDragStart?: () => void;
  /** position = 이 항목을 뺀 목록 기준 위치 (5-3 MOVE의 position과 같습니다) */
  onDrop: (key: string, position: number) => void;
};

/** 들어올린 카드를 position(뺀 목록 기준)에 놓았을 때의 카드 top */
function slotTop(tops: number[], heights: number[], from: number, position: number) {
  "worklet";
  let top = tops.length > 0 ? tops[0] : 0;
  let placed = 0;
  for (let i = 0; i < tops.length && placed < position; i += 1) {
    if (i === from) continue;
    top += heights[i] + ROW_GAP;
    placed += 1;
  }
  return top;
}

function targetFor(tops: number[], heights: number[], from: number, centerY: number) {
  "worklet";
  let position = 0;
  for (let i = 0; i < tops.length; i += 1) {
    if (i !== from && centerY > tops[i] + heights[i] / 2) position += 1;
  }
  return position;
}

export function DraggableList<T>({ items, keyOf, renderItem, enabled, scroll, onDragStart, onDrop }: Props<T>) {
  const tops = useSharedValue<number[]>([]);
  const heights = useSharedValue<number[]>([]);
  // 카드 위치는 JS 쪽 ref에 먼저 모읍니다. onLayout이 연달아 올 때 공유 값을 읽어 고치면 앞 카드 값이 아직 반영되기 전이라
  // 빈 칸(undefined → NaN)이 생기고, 들어올린 카드가 사라진 채 멈췄습니다.
  const layout = useRef<{ tops: number[]; heights: number[] }>({ tops: [], heights: [] });
  const active = useSharedValue(-1);
  const target = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const translation = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const virtualScroll = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const viewTop = useSharedValue(0);
  const viewHeight = useSharedValue(0);
  /** 순서가 바뀐 직후 한 프레임은 스프링 없이 제자리로 (새 레이아웃이 이미 그 자리) */
  const instant = useSharedValue(0);

  const order = items.map(keyOf).join("|");
  useLayoutEffect(() => {
    instant.set(1);
    active.set(-1);
    target.set(-1);
    dragY.set(0);
    const id = requestAnimationFrame(() => instant.set(0));
    return () => cancelAnimationFrame(id);
  }, [order, instant, active, target, dragY]);

  const setLayout = (index: number, e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    const l = layout.current;
    l.tops[index] = y;
    l.heights[index] = height;
    l.tops.length = items.length;
    l.heights.length = items.length;
    tops.set([...l.tops]);
    heights.set([...l.heights]);
  };

  const updateDrag = () => {
    "worklet";
    const from = active.get();
    if (from < 0) return;
    const t = tops.get();
    const h = heights.get();
    // 아직 모든 카드의 위치를 받지 못했으면 움직이지 않습니다.
    if (t.length === 0 || t[from] === undefined || h[from] === undefined || t[t.length - 1] === undefined) return;
    const raw = translation.get() + (virtualScroll.get() - startScroll.get());
    const minY = (t[0] ?? 0) - t[from];
    const last = t.length - 1;
    const maxY = t[last] + h[last] - (t[from] + h[from]);
    const y = Math.min(maxY, Math.max(minY, raw));
    dragY.set(y);
    const next = targetFor(t, h, from, t[from] + y + h[from] / 2);
    if (next !== target.get()) {
      target.set(next);
      scheduleOnRN(haptics.tick);
    }
  };

  // 화면 끝 근처에서 페이지를 저절로 스크롤합니다.
  useFrameCallback(() => {
    if (active.get() < 0) return;
    const y = fingerY.get();
    const top = viewTop.get();
    const bottom = top + viewHeight.get();
    let delta = 0;
    if (y < top + EDGE) delta = -MAX_SPEED * Math.min(1, (top + EDGE - y) / EDGE);
    else if (y > bottom - EDGE) delta = MAX_SPEED * Math.min(1, (y - (bottom - EDGE)) / EDGE);
    if (delta === 0) return;
    const max = Math.max(0, scroll.contentHeight.get() - viewHeight.get());
    const next = Math.min(max, Math.max(0, virtualScroll.get() + delta));
    if (next === virtualScroll.get()) return;
    virtualScroll.set(next);
    scrollTo(scroll.ref, 0, next, false);
    updateDrag();
  });

  const release = () => {
    active.set(-1);
    target.set(-1);
    dragY.set(0);
  };

  const finish = (key: string, from: number, position: number) => {
    if (position === from) {
      release();
      return;
    }
    onDrop(key, position);
    // 보통은 순서가 바뀌며 위 useLayoutEffect가 정리합니다. 화면이 순서를 바꾸지 않았으면(옮길 수 없는 자리) 제자리로 돌립니다.
    setTimeout(() => {
      if (active.get() >= 0) release();
    }, 600);
  };

  // 제스처는 렌더마다 새로 만듭니다 (GestureDetector가 드래그 중에도 끊지 않고 콜백만 바꿉니다).
  const gestures = items.map((item, index) => {
    const key = keyOf(item);
    return Gesture.Pan()
      .enabled(enabled)
      .activateAfterLongPress(LONG_PRESS_MS)
      .onStart((e) => {
        const m = measure(scroll.ref);
        if (m) {
          viewTop.set(m.pageY);
          viewHeight.set(m.height);
        }
        startScroll.set(scroll.offset.get());
        virtualScroll.set(scroll.offset.get());
        translation.set(0);
        fingerY.set(e.absoluteY);
        target.set(index);
        dragY.set(0);
        active.set(index);
        scheduleOnRN(haptics.thud);
        if (onDragStart) scheduleOnRN(onDragStart);
      })
      .onUpdate((e) => {
        translation.set(e.translationY);
        fingerY.set(e.absoluteY);
        updateDrag();
      })
      .onEnd(() => {
        const from = active.get();
        if (from < 0) return;
        const position = target.get();
        const landing = slotTop(tops.get(), heights.get(), from, position) - tops.get()[from];
        if (!Number.isFinite(landing)) {
          // 위치 정보가 비어 있으면 제자리로 돌려놓습니다 (멈춘 채 남지 않게).
          active.set(-1);
          target.set(-1);
          dragY.set(0);
          return;
        }
        dragY.set(
          withSpring(landing, motion.spring.snappy, (finished) => {
            if (finished) scheduleOnRN(finish, key, from, position);
          }),
        );
      })
      .onFinalize((_e, success) => {
        if (!success && active.get() >= 0 && target.get() < 0) active.set(-1);
      });
  });

  return (
    <View>
      {items.map((item, index) => (
        <Row
          key={keyOf(item)}
          index={index}
          active={active}
          target={target}
          dragY={dragY}
          heights={heights}
          instant={instant}
          onLayout={(e) => setLayout(index, e)}
        >
          {renderItem(
            item,
            enabled ? (
              <GestureDetector gesture={gestures[index]}>
                <View style={styles.handleHit} accessibilityRole="adjustable" accessibilityLabel="길게 눌러 순서 바꾸기" hitSlop={8}>
                  <View style={styles.handleBar} />
                  <View style={styles.handleBar} />
                  <View style={styles.handleBar} />
                </View>
              </GestureDetector>
            ) : undefined,
          )}
        </Row>
      ))}
      <DropLine active={active} target={target} tops={tops} heights={heights} />
    </View>
  );
}

type RowProps = {
  index: number;
  active: SharedValue<number>;
  target: SharedValue<number>;
  dragY: SharedValue<number>;
  heights: SharedValue<number[]>;
  instant: SharedValue<number>;
  onLayout: (e: LayoutChangeEvent) => void;
  children: ReactNode;
};

function Row({ index, active, target, dragY, heights, instant, onLayout, children }: RowProps) {
  const style = useAnimatedStyle(() => {
    const a = active.get();
    const settle = instant.get() === 1;
    if (a === index) {
      return {
        zIndex: 10,
        transform: [{ translateY: dragY.get() }, { scale: withSpring(1.03, motion.spring.snappy) }],
        ...(shadows.label as object),
      };
    }
    let shift = 0;
    if (a >= 0) {
      const t = target.get();
      const gap = (heights.get()[a] ?? 0) + ROW_GAP;
      if (a < index && index <= t) shift = -gap;
      else if (t <= index && index < a) shift = gap;
    }
    return {
      zIndex: 0,
      // 들어올렸을 때 준 그림자를 직접 지웁니다 (애니메이션 스타일은 빠진 키를 이전 값 그대로 둡니다).
      ...NO_SHADOW,
      transform: [{ translateY: settle ? 0 : withSpring(shift, motion.spring.gentle) }, { scale: settle ? 1 : withTiming(1, motion.timing.fast) }],
    };
  });

  return (
    <Animated.View style={[styles.row, style]} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}

function DropLine({
  active,
  target,
  tops,
  heights,
}: {
  active: SharedValue<number>;
  target: SharedValue<number>;
  tops: SharedValue<number[]>;
  heights: SharedValue<number[]>;
}) {
  const style = useAnimatedStyle(() => {
    const a = active.get();
    if (a < 0) return { opacity: withTiming(0, motion.timing.fast) };
    const top = slotTop(tops.get(), heights.get(), a, target.get()) - ROW_GAP / 2 - 2;
    if (!Number.isFinite(top)) return { opacity: 0 };
    return {
      opacity: withTiming(1, motion.timing.fast),
      transform: [{ translateY: withSpring(top, motion.spring.snappy) }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.dropLine, style]} />;
}

const styles = StyleSheet.create({
  row: {
    marginBottom: ROW_GAP,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  handleHit: {
    width: 32,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  handleBar: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.muted,
  },
  dropLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.blue,
  },
});
