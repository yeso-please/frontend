import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { AppText, SelectableChip, type ChipHandle } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { colors, motion, screenPadding, space } from "@/theme";

import { EXCLUSION_TAGS, MAX_PREFERENCE_TAGS, PREFERENCE_TAGS } from "./tags";

type Props = {
  preferences: string[];
  exclusions: string[];
  onPreferences: (tags: string[]) => void;
  onExclusions: (tags: string[]) => void;
};

/** 피그마 S2 · 경험 태그 & 제외 조건 (400:1456) */
export function TagStep({ preferences, exclusions, onPreferences, onExclusions }: Props) {
  const chipRefs = useRef<Record<string, ChipHandle | null>>({});
  const [limitHit, setLimitHit] = useState(false);
  const bump = useSharedValue(1);

  useEffect(() => {
    if (!limitHit) return;
    const timer = setTimeout(() => setLimitHit(false), 2400);
    return () => clearTimeout(timer);
  }, [limitHit]);

  const count = preferences.length;
  useEffect(() => {
    bump.set(withSequence(withTiming(1.25, { duration: 90 }), withSpring(1, motion.spring.snappy)));
  }, [count, bump]);
  const countStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  const togglePreference = (tag: string) => {
    if (preferences.includes(tag)) {
      onPreferences(preferences.filter((t) => t !== tag));
      return;
    }
    if (count >= MAX_PREFERENCE_TAGS) {
      // 5개면 추가를 막고 그 칩을 흔들어 알려 줍니다 (선택 해제는 가능)
      chipRefs.current[tag]?.shake();
      haptics.reject();
      setLimitHit(true);
      return;
    }
    onPreferences([...preferences, tag]);
  };

  const toggleExclusion = (tag: string) => onExclusions(exclusions.includes(tag) ? exclusions.filter((t) => t !== tag) : [...exclusions, tag]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <AppText variant="caption" color="blue">
          좋아하는 경험
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          {"어떤 곳이라면\n걸어볼 만해요?"}
        </AppText>
        <AppText variant="body" color="muted">
          평소 좋아했던 여행 경험을 골라주세요.
        </AppText>
        {/* 피그마 Medium 10 → 가독성 최저선(12)으로 올림 */}
        <AppText variant="caption" color="muted">
          선택하지 않아도 괜찮아요
        </AppText>

        <View style={styles.counterRow}>
          <View style={styles.counter} accessible accessibilityLabel={`${MAX_PREFERENCE_TAGS}개 중 ${count}개 선택`}>
            <Animated.View style={countStyle}>
              <AppText variant="label" color="blue">
                {count}
              </AppText>
            </Animated.View>
            <AppText variant="caption" color="blue">
              {` / ${MAX_PREFERENCE_TAGS} 선택`}
            </AppText>
          </View>
          {limitHit ? (
            <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(200)}>
              <AppText variant="caption" color="blue" accessibilityLiveRegion="assertive">
                {`최대 ${MAX_PREFERENCE_TAGS}개까지 선택할 수 있어요.`}
              </AppText>
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.chips}>
          {PREFERENCE_TAGS.map((tag) => (
            <SelectableChip
              key={tag}
              ref={(r) => {
                chipRefs.current[tag] = r;
              }}
              label={tag}
              selected={preferences.includes(tag)}
              blocked={!preferences.includes(tag) && preferences.length >= MAX_PREFERENCE_TAGS}
              onPress={() => togglePreference(tag)}
            />
          ))}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <AppText variant="caption" color="muted">
          제외 조건 · 선택
        </AppText>
        <AppText variant="cardTitle" accessibilityRole="header">
          이런 여행은 피하고 싶어요.
        </AppText>
        <AppText variant="body" color="muted">
          추천에서 빼고 싶은 조건을 골라주세요.
        </AppText>
        <View style={styles.chips}>
          {EXCLUSION_TAGS.map((tag) => (
            <SelectableChip key={tag} tone="exclusion" label={tag} selected={exclusions.includes(tag)} onPress={() => toggleExclusion(tag)} />
          ))}
        </View>
        <AppText variant="caption" color="muted">
          성향 결과와 별도로, 여행 추천에 반영해요.
        </AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: space[24], gap: space[24] },
  section: { gap: space[12] },
  counterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24 },
  counter: { flexDirection: "row", alignItems: "baseline" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[8] },
  divider: { height: 1, backgroundColor: colors.border },
});
