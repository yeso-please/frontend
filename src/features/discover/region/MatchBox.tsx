import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { regionApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import { AppText } from "@/components/ui";
import { colors, fonts, radius, space } from "@/theme";

import { ShimmerBlock } from "../components/Shimmer";

/**
 * B4 "우연으로 만나, 취향으로 가까워지는 곳" — 7-6 성향 맞춤 지역 문장. 서버 문장(text)이 완결된 문장이라
 * 앞에 아무것도 붙이지 않고 그대로 보여 줍니다. LLM 문장이면 "AI가 작성"을 표시합니다.
 * 설문 v1·MBTI가 없으면 text가 null이라 영역을 숨깁니다.
 */
export function MatchBox({ sigCd }: { sigCd: string }) {
  const match = useQuery({ queryKey: queryKeys.regionMatch(sigCd), queryFn: () => regionApi.match(sigCd), staleTime: 10 * 60_000 });

  if (match.isError || (match.isSuccess && !match.data.text)) return null;
  const data = match.data;

  return (
    <Animated.View layout={LinearTransition.springify()} style={styles.box}>
      <View style={styles.head}>
        <AppText variant="caption" color="darkgreen" style={styles.title}>
          우연으로 만나, 취향으로 가까워지는 곳
        </AppText>
        {data?.aiGenerated ? (
          <View style={styles.aiBadge} accessibilityLabel="AI가 작성한 문장이에요">
            <AppText variant="badge" color="darkgreen" style={styles.aiText}>
              AI가 작성
            </AppText>
          </View>
        ) : null}
      </View>
      {data?.text ? (
        <Animated.View entering={FadeIn.duration(260)}>
          <AppText variant="body">{data.text}</AppText>
        </Animated.View>
      ) : (
        <View style={styles.loading} accessibilityLabel="맞춤 문장을 쓰는 중이에요">
          <ShimmerBlock width={260} height={14} />
          <ShimmerBlock width={220} height={14} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 피그마: mint 박스 r16, 안쪽 16
  box: { borderRadius: radius.lg, backgroundColor: colors.mint, padding: space[16], gap: space[8] },
  head: { flexDirection: "row", alignItems: "center", gap: space[8] },
  title: { flex: 1, fontFamily: fonts.bold },
  aiBadge: { paddingHorizontal: 8, height: 20, borderRadius: radius.pill, backgroundColor: colors.white, justifyContent: "center" },
  aiText: { fontFamily: fonts.bold },
  loading: { gap: 8, paddingVertical: 3 },
});
