import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { colors } from "@/theme";

// 피그마 Home 배경: 중심(195, 422) 반경 rx≈380 / ry≈325, #CAEAFF → 흰색.
// 02~04는 반경이 조금씩 달라(§2.1) 01 값 하나로 통일했습니다. 상태바 뒤까지 깔립니다.
export function HomeBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id="homeBackground" cx="50%" cy="55%" rx="97%" ry="42%" fx="50%" fy="55%">
          <Stop offset="0" stopColor={colors.homeGradientFrom} />
          <Stop offset="1" stopColor={colors.white} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeBackground)" />
    </Svg>
  );
}
