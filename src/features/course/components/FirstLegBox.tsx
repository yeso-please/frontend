import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { courseApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, PressableScale } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { colors, radius, space } from "@/theme";

import { firstLegParts } from "../format";

type Spot = { lat: number; lng: number };
type Status = "idle" | "locating" | "denied" | "unavailable" | "ready";

/** 100m 안에서는 같은 결과를 씁니다 (서버도 100m 안이면 기억한 결과를 돌려줌). 약 0.001도 ≈ 100m */
const keyOf = (v: number) => Math.round(v * 1000);

/**
 * 그날 첫 관광지 카드 위 "지금 위치에서 거리 보기" (요청서 #6 · 5-8, 참여자 전용).
 * 화면에 들어올 때는 권한을 묻지 않고 버튼을 눌렀을 때 "앱 사용 중" 위치 권한만 요청합니다.
 * 좌표는 이 화면 메모리에만 두고 query로만 보내며 저장·표시하지 않습니다.
 */
export function FirstLegBox({ tripId, dayIndex }: { tripId: number; dayIndex: number }) {
  const [status, setStatus] = useState<Status>("idle");
  const [spot, setSpot] = useState<Spot | null>(null);

  const leg = useQuery({
    queryKey: queryKeys.firstLeg(tripId, dayIndex, keyOf(spot?.lat ?? 0), keyOf(spot?.lng ?? 0)),
    queryFn: () => courseApi.firstLeg(tripId, dayIndex, spot!.lat, spot!.lng),
    enabled: !!spot,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const locate = async () => {
    haptics.tap();
    setStatus("locating");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setStatus("denied");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setSpot({ lat: position.coords.latitude, lng: position.coords.longitude });
      setStatus("ready");
    } catch {
      setStatus("unavailable");
    }
  };

  if (status === "idle" || status === "locating") {
    return (
      <PressableScale
        onPress={() => void locate()}
        disabled={status === "locating"}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="지금 위치에서 첫 장소까지 거리 보기"
        accessibilityHint="위치 권한을 물어요. 위치는 저장하지 않아요"
      >
        <AppText variant="small13Medium" color="darkgreen">
          {status === "locating" ? "위치를 확인하는 중…" : "📍 지금 위치에서 거리 보기"}
        </AppText>
      </PressableScale>
    );
  }

  if (status === "denied" || status === "unavailable") {
    return (
      <View style={styles.box}>
        <AppText variant="small13" color="muted">
          {status === "denied" ? "위치 권한을 켜면 거리를 볼 수 있어요." : "지금 위치를 확인하지 못했어요."}
        </AppText>
        <PressableScale
          onPress={() => (status === "denied" ? void Linking.openSettings() : void locate())}
          hitSlop={8}
          accessibilityRole="button"
        >
          <AppText variant="small12" color="blue">
            {status === "denied" ? "설정 열기" : "다시 시도"}
          </AppText>
        </PressableScale>
      </View>
    );
  }

  if (leg.isPending) {
    return (
      <View style={styles.box}>
        <AppText variant="small13" color="muted">
          지금 위치에서 첫 장소까지 길을 찾는 중이에요…
        </AppText>
      </View>
    );
  }
  if (leg.isError) {
    // 국내 범위 밖 좌표·그날 관광지 없음은 400
    const outside = isApiError(leg.error, "COMMON_INVALID_REQUEST");
    return (
      <View style={styles.box}>
        <AppText variant="small13" color="muted">
          {outside ? "국내에서, 관광지가 있는 날에만 거리를 볼 수 있어요." : errorMessage(leg.error)}
        </AppText>
      </View>
    );
  }

  const parts = firstLegParts(leg.data);
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.box} accessible accessibilityLabel={`지금 위치에서 ${leg.data.name}까지 ${parts.map((p) => p.text).join(", ")}`}>
      <AppText variant="small12" color="darkgreen">{`지금 위치 → ${leg.data.name}`}</AppText>
      <AppText variant="small13">{parts.map((p) => p.text).join(" · ")}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: { height: 40, borderRadius: radius.md, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center", marginBottom: space[8] },
  box: { gap: 2, padding: space[12], borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: space[8] },
});
