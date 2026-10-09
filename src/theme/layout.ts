import type { ViewStyle } from "react-native";

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

// RN 0.76+ 는 boxShadow 문자열을 Android에서도 지원합니다.
export const shadows = {
  sheet: { boxShadow: "0px -6px 24px rgba(20, 41, 28, 0.08)" },
  label: { boxShadow: "2px 5px 10px rgba(0, 0, 0, 0.10)" },
  card: { boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)" },
  knob: { boxShadow: "0px 4px 6px -1px rgba(0, 0, 0, 0.10)" },
} satisfies Record<string, ViewStyle>;
