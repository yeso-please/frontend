import { Platform, type ViewStyle } from "react-native";

export const space = { 4: 4, 8: 8, 12: 12, 16: 16, 24: 24, 32: 32 } as const;

export const radius = { xs: 2, sm: 8, md: 12, lg: 16, xl: 24, pill: 9999 } as const;

// 화면 좌우 여백 24 → 390 기준 콘텐츠 폭 342
export const screenPadding = 24;

export const sizes = {
  appBar: 48,
  homeAppBar: 44,
  tabBar: 64,
  ctaHeight: 52,
  touchTarget: 44,
} as const;

// 피그마 그림자 값. Android에서 boxShadow는 블러를 별도 GPU 버퍼(오프스크린 렌더 타깃)에 그려
// QHD 화면에서 메모리를 크게 쓰므로(측정: 상호작용 후 그래픽 메모리 +114MB), Android는 하드웨어 그림자(elevation)로 대신합니다.
// elevation 그림자는 배경색이 있는 뷰에서만 보입니다.
const shadow = (box: string, elevation: number, shadowColor = "#14291C"): ViewStyle =>
  Platform.OS === "android" ? { elevation, shadowColor } : { boxShadow: box };

export const shadows = {
  sheet: shadow("0px -6px 24px rgba(20, 41, 28, 0.08)", 12),
  label: shadow("2px 5px 10px rgba(0, 0, 0, 0.10)", 4, "#000000"),
  card: shadow("0px 1px 2px rgba(0, 0, 0, 0.05)", 1, "#000000"),
  knob: shadow("0px 4px 6px -1px rgba(0, 0, 0, 0.10)", 3, "#000000"),
} satisfies Record<string, ViewStyle>;
