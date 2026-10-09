import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import type { TravelMotive } from "@/api/types";
import { AppText } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { space } from "@/theme";

import { ChoiceCard, type ChoiceCardHandle } from "./ChoiceCard";
import { motiveIcon, motiveSubtitle, sortMotives } from "./motives";
import { StepHeading } from "./StepHeading";
import { StepScroll } from "./StepScroll";

type Props = {
  motives: TravelMotive[];
  max: number;
  selected: number[];
  onChange: (codes: number[]) => void;
};

/** 2단계 — 피그마 온보딩 여행 동기 (401:1071). 최대 max개, 넘기면 카드가 흔들리고 안내 문구가 나옵니다. */
export function MotiveStep({ motives, max, selected, onChange }: Props) {
  const cardRefs = useRef<Record<number, ChoiceCardHandle | null>>({});
  const [limitHit, setLimitHit] = useState(false);

  useEffect(() => {
    if (!limitHit) return;
    const timer = setTimeout(() => setLimitHit(false), 2200);
    return () => clearTimeout(timer);
  }, [limitHit]);

  const toggle = (code: number) => {
    if (selected.includes(code)) {
      haptics.tick();
      onChange(selected.filter((c) => c !== code));
      return;
    }
    if (selected.length >= max) {
      haptics.reject();
      cardRefs.current[code]?.shake();
      setLimitHit(true);
      return;
    }
    haptics.tick();
    onChange([...selected, code]);
  };

  return (
    <StepScroll>
      <StepHeading title="여행을 떠나는 이유는?" subtitle={`여행의 목적을 골라주세요. (최대 ${max}개)`}>
        <View style={styles.counterRow}>
          <View style={styles.counter} accessibilityLiveRegion="polite">
            <AppText variant="label" color="onboardingAccent">
              {selected.length}
            </AppText>
            <AppText variant="caption" color="onboardingAccent">
              {` / ${max} 선택`}
            </AppText>
          </View>
          {limitHit ? (
            <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(200)}>
              <AppText variant="caption" color="onboardingAccent" accessibilityLiveRegion="assertive">
                {`최대 ${max}개까지 고를 수 있어요.`}
              </AppText>
            </Animated.View>
          ) : null}
        </View>
      </StepHeading>
      <View style={styles.list}>
        {sortMotives(motives).map((m) => (
          <ChoiceCard
            key={m.code}
            ref={(r) => {
              cardRefs.current[m.code] = r;
            }}
            title={m.label}
            subtitle={motiveSubtitle(m.code)}
            icon={motiveIcon(m.code)}
            selected={selected.includes(m.code)}
            onPress={() => toggle(m.code)}
          />
        ))}
      </View>
    </StepScroll>
  );
}

const styles = StyleSheet.create({
  counterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24, marginTop: space[4] },
  counter: { flexDirection: "row", alignItems: "baseline" },
  list: { gap: space[12] },
});
