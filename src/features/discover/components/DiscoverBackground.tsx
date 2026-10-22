import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { colors } from "@/theme";

// 피그마 B1 배경: 지도 주위가 연한 하늘색(#CAEAFF 계열)으로 번지고 가장자리는 흰색.
// 3D 지형 그림의 가장자리 하늘색과 이어지도록 중심을 지도 쪽에 둡니다. 상태바 뒤까지 깔립니다.
export function DiscoverBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id="discoverBackground" cx="50%" cy="55%" rx="97%" ry="42%" fx="50%" fy="55%">
          <Stop offset="0" stopColor={colors.homeGradientFrom} />
          <Stop offset="1" stopColor={colors.white} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#discoverBackground)" />
    </Svg>
  );
}
