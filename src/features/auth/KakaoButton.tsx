import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { AppText, PressableScale } from "@/components/ui";
import { radius, sizes } from "@/theme";

// 카카오 로그인 버튼 디자인 가이드: 배경 #FEE500, 심볼·글자 #000000(85%), 둥근 모서리
const KAKAO_YELLOW = "#FEE500";
const KAKAO_LABEL = "rgba(0, 0, 0, 0.85)";

function KakaoSymbol() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        fill="#000000"
        d="M9 1.5C4.58 1.5 1 4.31 1 7.78c0 2.24 1.5 4.21 3.75 5.32l-.95 3.48c-.08.3.26.54.52.37l4.15-2.74c.17.01.35.02.53.02 4.42 0 8-2.81 8-6.28S13.42 1.5 9 1.5Z"
      />
    </Svg>
  );
}

export function KakaoButton({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={loading}
      style={[styles.button, loading && styles.loading]}
      accessibilityRole="button"
      accessibilityLabel="카카오로 시작하기"
      accessibilityState={{ busy: !!loading }}
    >
      <View style={styles.row}>
        <KakaoSymbol />
        <AppText variant="label" style={styles.label}>
          {loading ? "카카오로 로그인하는 중" : "카카오로 시작하기"}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { height: sizes.ctaHeight, borderRadius: radius.md, backgroundColor: KAKAO_YELLOW, alignItems: "center", justifyContent: "center" },
  loading: { opacity: 0.7 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { color: KAKAO_LABEL },
});
