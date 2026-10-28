import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { colors, motion } from "@/theme";

type TabMeta = { label: string; icon: (active: boolean) => React.ReactNode };

// 피그마 TriPin/Navigation — 홈 / 여행 / 내 코스 / MY. 활성 = darkgreen 아이콘·라벨. "저장"은 이번 범위에서 뺍니다 (D14).
// 내 코스 아이콘은 추가 화면 01의 20px 경로 아이콘이라 22px 칸 가운데에 둡니다.
const TABS: Record<string, TabMeta> = {
  index: { label: "홈", icon: (a) => (a ? <Icons.NavHomeActive width={22} height={22} /> : <Icons.NavHome width={22} height={22} />) },
  travel: { label: "여행", icon: (a) => (a ? <Icons.NavTripActive width={22} height={22} /> : <Icons.NavTrip width={22} height={22} />) },
  courses: {
    label: "내 코스",
    icon: (a) => <View style={styles.icon22}>{a ? <Icons.NavCourseActive width={20} height={20} /> : <Icons.NavCourse width={20} height={20} />}</View>,
  },
  my: { label: "MY", icon: (a) => (a ? <Icons.NavUserActive width={22} height={22} /> : <Icons.NavUser width={22} height={22} />) },
};

function TabItem({ meta, focused, onPress }: { meta: TabMeta; focused: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) scale.value = withSequence(withSpring(1.12, motion.spring.snappy), withSpring(1, motion.spring.snappy));
  }, [focused, scale]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <PressableScale
      onPress={onPress}
      haptic={focused ? false : "tick"}
      scaleTo={0.92}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
    >
      <Animated.View style={iconStyle}>{meta.icon(focused)}</Animated.View>
      <AppText variant="caption" color={focused ? "darkgreen" : "muted"}>
        {meta.label}
      </AppText>
    </PressableScale>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        return (
          <TabItem
            key={route.key}
            meta={meta}
            focused={focused}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  item: { flex: 1, height: 56, alignItems: "center", justifyContent: "center", gap: 2 },
  icon22: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
});
