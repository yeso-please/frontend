import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, Button, ErrorView } from "@/components/ui";
import { colors, radius, screenPadding, shadows, space } from "@/theme";

import type { DrawMode, HomePhase } from "../store";

type Props = {
  top: number;
  phase: HomePhase;
  mode: DrawMode;
  regionsPending: boolean;
  regionsError: unknown;
  onRetry: () => void;
  onRandom: () => void;
  onManual: () => void;
};

/** 01 버튼(랜덤 핀 꽂기 / 직접 지역 선택하기) ⇄ 02 Loading 버튼. 03·04는 시트가 덮으므로 비웁니다. */
export function HomeActions({ top, phase, mode, regionsPending, regionsError, onRetry, onRandom, onManual }: Props) {
  const showError = phase === "idle" && !!regionsError;

  return (
    <View style={[styles.slot, { top }]} pointerEvents="box-none">
      {showError ? (
        // 지역 목록을 못 받으면 버튼 자리에 다시 시도 카드를 둡니다.
        <Animated.View key="error" entering={FadeInDown.springify()} exiting={FadeOut} style={styles.errorCard}>
          <ErrorView error={regionsError} onRetry={onRetry} />
        </Animated.View>
      ) : phase === "idle" ? (
        <Animated.View key="idle" entering={FadeInDown.duration(320)} exiting={FadeOut.duration(160)} style={styles.layer}>
          <Button
            label={regionsPending ? "지역을 불러오는 중" : "랜덤 핀 꽂기"}
            loading={regionsPending}
            variant="primary"
            height={46}
            leftIcon={<Icons.PinButton width={21} height={21} />}
            onPress={onRandom}
            accessibilityHint="앱이 여행지를 무작위로 골라 지도에 핀을 꽂아요"
          />
          <Button label="직접 지역 선택하기" variant="secondary" height={44} onPress={onManual} accessibilityHint="지역 목록에서 직접 골라요" />
        </Animated.View>
      ) : phase === "drawing" && mode === "random" ? (
        <Animated.View key="drawing" entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={styles.layer}>
          {/* 피그마 Style=Loading — refresh 아이콘이 돌고 누를 수 없습니다 */}
          <Button label="새로운 여행지를 찾는 중" variant="secondary" loading height={46} />
          <View style={styles.wait}>
            <AppText variant="label" color="darkgreen">
              잠시만 기다려주세요
            </AppText>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 피그마 Home actions (24, 652, 342×94): 버튼 46 + 간격 4 + 버튼 44
  slot: { position: "absolute", left: screenPadding, right: screenPadding, height: 94 },
  layer: { position: "absolute", left: 0, right: 0, top: 0, gap: space[4] },
  wait: { height: 44, alignItems: "center", justifyContent: "center" },
  errorCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 188,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    ...shadows.card,
  },
});
