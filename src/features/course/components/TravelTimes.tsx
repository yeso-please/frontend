import { StyleSheet, View } from "react-native";

import type { TravelLeg, Transport } from "@/api/types";
import { AppText } from "@/components/ui";
import { colors, radius, space } from "@/theme";

import { formatDistance, transitDetail, travelModes } from "../format";

type Props = {
  leg: TravelLeg | null;
  /** 여행 이동수단 — 기본 강조 (3-4 transport) */
  primary: Transport;
  /** 그날 첫 지점일 때 보여 줄 문구 */
  firstLabel?: string;
};

/**
 * 카드의 "09:00" 자리 (D5): 앞 장소에서 오는 시간을 도보·자동차·대중교통 세 수단으로 보여 줍니다.
 * 직선 추정이면 "약"이 붙고, 여행 이동수단을 강조합니다. 지도(5-7)를 한 번 열면 실제 경로 시간으로 바뀝니다.
 */
export function TravelTimes({ leg, primary, firstLabel = "오늘의 첫 장소" }: Props) {
  const modes = travelModes(leg);
  if (!leg || modes.length === 0) {
    return (
      <AppText variant="small13" color="muted">
        {firstLabel}
      </AppText>
    );
  }
  const transit = transitDetail(leg);
  const label = modes.map((m) => `${m.label} ${m.text}`).join(", ");
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`앞 장소에서 ${formatDistance(leg.meters)}, ${label}${transit ? `, ${transit}` : ""}`}>
      <View style={styles.row}>
        {modes.map((m) => {
          const strong = m.mode === primary;
          return (
            <View key={m.mode} style={[styles.pill, strong && styles.pillStrong]}>
              <AppText variant="badge" color={strong ? "darkgreen" : "muted"}>
                {`${m.label} ${m.text}`}
              </AppText>
            </View>
          );
        })}
      </View>
      <AppText variant="tiny11" color="muted">
        {`앞 장소에서 ${formatDistance(leg.meters)}${transit ? ` · ${transit}` : ""}`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space[4] },
  pill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: colors.surface },
  pillStrong: { backgroundColor: colors.mint },
});
