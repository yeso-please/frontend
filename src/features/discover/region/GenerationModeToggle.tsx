import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { toast } from "sonner-native";

import { preferencesApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { Preferences, TasteMode } from "@/api/types";
import { AppText, PressableScale } from "@/components/ui";
import { colors, motion, radius, shadows } from "@/theme";

const OPTIONS: { mode: TasteMode; label: string; hint: string }[] = [
  { mode: "TASTE", label: "내 여행 성향 반영", hint: "코스를 내 취향에 맞춰 골라요" },
  { mode: "RANDOM", label: "완전 랜덤", hint: "취향과 상관없이 무작위로 코스를 골라요" },
];

/**
 * 피그마 TriPin/Travel/Generation Mode (24,857 · 342×48). 코스 생성(5-1)은 tasteMode를 보내지 않아
 * 요청한 사람의 프로필 설정(2-11 courseTasteMode)을 쓰므로 여기서 그 설정을 바로 바꿉니다 (낙관적 갱신).
 */
export function GenerationModeToggle() {
  const queryClient = useQueryClient();
  const [width, setWidth] = useState(0);
  const prefs = useQuery({ queryKey: queryKeys.preferences, queryFn: preferencesApi.get, staleTime: 5 * 60_000 });
  const update = useMutation({
    mutationFn: (mode: TasteMode) => preferencesApi.update(mode),
    onMutate: async (mode) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.preferences });
      const previous = queryClient.getQueryData<Preferences>(queryKeys.preferences);
      queryClient.setQueryData<Preferences>(queryKeys.preferences, { courseTasteMode: mode });
      return { previous };
    },
    onError: (_error, _mode, context) => {
      queryClient.setQueryData(queryKeys.preferences, context?.previous);
      toast.error("코스 방식을 바꾸지 못했어요", { description: "잠시 후 다시 시도해 주세요." });
    },
    onSuccess: (data) => queryClient.setQueryData(queryKeys.preferences, data),
  });

  const mode = prefs.data?.courseTasteMode ?? "TASTE";
  const index = OPTIONS.findIndex((o) => o.mode === mode);
  const segment = (width - 8) / 2;
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(index * segment, motion.spring.snappy) }] }), [index, segment]);

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="radiogroup" accessibilityLabel="코스 만드는 방식">
      {width > 0 ? <Animated.View style={[styles.thumb, { width: segment }, thumbStyle]} /> : null}
      {OPTIONS.map((option) => {
        const selected = option.mode === mode;
        return (
          <PressableScale
            key={option.mode}
            onPress={() => {
              if (!selected) update.mutate(option.mode);
            }}
            haptic={selected ? false : "tick"}
            scaleTo={0.97}
            style={styles.option}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
          >
            <AppText variant={selected ? "small13Bold" : "small13"} color={selected ? "darkgreen" : "muted"}>
              {selected ? `✓ ${option.label}` : option.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 48, padding: 4, borderRadius: 14, backgroundColor: colors.surface, flexDirection: "row" },
  thumb: { position: "absolute", left: 4, top: 4, bottom: 4, borderRadius: radius.md, backgroundColor: colors.white, ...shadows.card },
  option: { flex: 1, alignItems: "center", justifyContent: "center" },
});
