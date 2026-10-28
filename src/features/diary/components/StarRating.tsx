import { StyleSheet, View } from "react-native";

import { Icons } from "@/components/icons";
import { PressableScale } from "@/components/ui";

import { SATISFACTION_LABELS } from "../constants";

const STARS = [1, 2, 3, 4, 5] as const;

/** 추가 화면 02·03 "어땠나요?" 별점 (30px). 같은 별을 다시 누르면 지웁니다. */
export function StarRatingInput({ value, onChange }: { value: number | null; onChange: (next: number | null) => void }) {
  return (
    <View style={styles.row30} accessibilityRole="adjustable" accessibilityLabel="전체 여행 별점" accessibilityValue={{ min: 0, max: 5, now: value ?? 0 }}>
      {STARS.map((n) => {
        const on = value !== null && n <= value;
        return (
          <PressableScale
            key={n}
            onPress={() => onChange(value === n ? null : n)}
            haptic="tick"
            scaleTo={0.85}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${n}점, ${SATISFACTION_LABELS[n - 1]}`}
            accessibilityState={{ selected: value === n }}
          >
            {on ? <Icons.Star30 width={30} height={30} /> : <Icons.Star30Empty width={30} height={30} />}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** 여행기 보기·목록용 작은 별점 (14px) */
export function StarRatingView({ value }: { value: number }) {
  return (
    <View style={styles.row14}>
      {STARS.map((n) => (n <= value ? <Icons.Star14 key={n} width={14} height={14} /> : <Icons.Star14Empty key={n} width={14} height={14} />))}
    </View>
  );
}

const styles = StyleSheet.create({
  row30: { flexDirection: "row", alignItems: "center", gap: 5 },
  row14: { flexDirection: "row", alignItems: "center", gap: 1 },
});
