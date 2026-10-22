import type { ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { interpolate, interpolateColor, type SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { colors, screenPadding, space } from "@/theme";

/** 다음 카드가 살짝 보이도록 남기는 폭 */
const PEEK = 20;
const GAP = space[12];

type Props<T> = {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, width: number) => ReactNode;
};

/** 홈 "준비 중인 여행" 카드를 가로로 넘깁니다 (여행이 여러 개일 때 다음 카드가 살짝 보이고, 아래 점이 현재 위치를 보여 줍니다). */
export function TripCarousel<T>({ items, keyOf, renderItem }: Props<T>) {
  const { width: screenWidth } = useWindowDimensions();
  const multiple = items.length > 1;
  const cardWidth = screenWidth - screenPadding * 2 - (multiple ? PEEK : 0);
  const interval = cardWidth + GAP;
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });

  if (!multiple) return <View style={styles.single}>{items[0] ? renderItem(items[0], cardWidth) : null}</View>;

  return (
    <View style={styles.wrap}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.track}
        accessibilityLabel={`준비 중인 여행 ${items.length}개, 옆으로 넘겨 보세요`}
      >
        {items.map((item, i) => (
          <View key={keyOf(item)} style={i < items.length - 1 ? { marginRight: GAP } : undefined}>
            {renderItem(item, cardWidth)}
          </View>
        ))}
      </Animated.ScrollView>
      <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {items.map((item, i) => (
          <Dot key={keyOf(item)} index={i} interval={interval} scrollX={scrollX} />
        ))}
      </View>
    </View>
  );
}

function Dot({ index, interval, scrollX }: { index: number; interval: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(scrollX.get() / interval, [index - 1, index, index + 1], [0, 1, 0], "clamp");
    return { width: 6 + t * 12, backgroundColor: interpolateColor(t, [0, 1], [colors.border, colors.green]) };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  single: { paddingHorizontal: screenPadding },
  wrap: { gap: space[12] },
  track: { paddingHorizontal: screenPadding },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 6, borderRadius: 3 },
});
