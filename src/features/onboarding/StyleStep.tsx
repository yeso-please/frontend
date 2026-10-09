import { StyleSheet, View } from "react-native";

import type { TravelStyleQuestion } from "@/api/types";
import { space } from "@/theme";

import { StepHeading } from "./StepHeading";
import { StepScroll } from "./StepScroll";
import { StyleSliderCard } from "./StyleSliderCard";

type Props = {
  questions: TravelStyleQuestion[];
  values: Record<string, number>;
  onChange: (number: number, value: number) => void;
};

/** 1단계 — 피그마 온보딩 여행 스타일 (401:947) */
export function StyleStep({ questions, values, onChange }: Props) {
  return (
    <StepScroll>
      <StepHeading title="여행할 때의 나는?" subtitle="나와 가장 가까운 성향을 선택해 주세요." />
      <View style={styles.list}>
        {questions.map((q) => (
          <StyleSliderCard key={q.number} question={q} value={values[String(q.number)] ?? q.neutralValue} onChange={(v) => onChange(q.number, v)} />
        ))}
      </View>
    </StepScroll>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[16] },
});
