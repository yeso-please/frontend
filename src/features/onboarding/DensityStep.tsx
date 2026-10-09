import { StyleSheet, View } from "react-native";

import type { ScheduleDensity } from "@/api/types";
import { AppText, SelectableChip } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { colors, radius, space } from "@/theme";

import { ChoiceCard } from "./ChoiceCard";
import { DENSITY_COPY } from "./motives";
import { StepHeading } from "./StepHeading";
import { StepScroll } from "./StepScroll";

type Props = {
  options: ScheduleDensity[];
  density: ScheduleDensity | null;
  onDensity: (d: ScheduleDensity) => void;
  excludeTags: string[];
  excluded: string[];
  onExcluded: (tags: string[]) => void;
};

/** 4단계 — 일정 밀도(필수) + 피하고 싶은 것(선택). 피그마 4/4 화면이 없어 2·3단계 카드 톤을 따릅니다. */
export function DensityStep({ options, density, onDensity, excludeTags, excluded, onExcluded }: Props) {
  return (
    <StepScroll>
      <StepHeading title="어떤 여행을 좋아하세요?" subtitle="하루 일정의 밀도를 골라주세요." />

      <View style={styles.list} accessibilityRole="radiogroup">
        {options.map((option) => {
          const copy = DENSITY_COPY[option] ?? { title: option, subtitle: "", perDay: 4 };
          return (
            <ChoiceCard
              key={option}
              role="radio"
              title={copy.title}
              subtitle={copy.subtitle}
              icon={<DensityDots count={copy.perDay} />}
              selected={density === option}
              onPress={() => {
                if (density !== option) haptics.tick();
                onDensity(option);
              }}
            />
          );
        })}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <AppText variant="label">피하고 싶은 것 (선택)</AppText>
          <AppText variant="small13" color="muted">
            추천에서 빼고 싶은 조건이 있다면 골라주세요.
          </AppText>
        </View>
        <View style={styles.chips}>
          {excludeTags.map((tag) => (
            <SelectableChip
              key={tag}
              tone="exclusion"
              label={tag}
              selected={excluded.includes(tag)}
              onPress={() => onExcluded(excluded.includes(tag) ? excluded.filter((t) => t !== tag) : [...excluded, tag])}
            />
          ))}
        </View>
      </View>
    </StepScroll>
  );
}

/** 하루에 둘러볼 곳 수를 점으로 보여 주는 작은 아이콘 (4곳 = 2×2, 6곳 = 3×2) */
function DensityDots({ count }: { count: number }) {
  const columns = count > 4 ? 3 : 2;
  return (
    <View style={[styles.dots, { width: columns * 8 + (columns - 1) * 5 }]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.dot} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[12] },
  section: { gap: space[16] },
  sectionHead: { gap: space[4] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[8] },
  dots: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.onboardingAccent },
});
