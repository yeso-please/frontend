// 피그마 "디자인 (초안)" 변수(get_variable_defs)에서 가져온 색. 새 색이 필요하면 여기에 이름을 붙여 추가합니다.
export const colors = {
  green: "#19B86A",
  darkgreen: "#0B6C40",
  mint: "#DDF5E8",
  blue: "#246BEB",
  paleblue: "#EDF3FF",
  charcoal: "#202520",
  muted: "#768078",
  border: "#E8EDE9",
  surface: "#F5F8F5",
  white: "#FFFFFF",

  // 비변수 색 (홈 배경·효과)
  homeGradientFrom: "#CAEAFF",
  glow: "rgba(25, 184, 106, 0.16)",
  routeLine: "rgba(25, 184, 106, 0.28)",
  scrim: "rgba(20, 41, 28, 0.32)",
  danger: "#D64545",

  // 온보딩(402px) 디자인 전용 색 — 토큰 밖이라 onboarding 화면에서만 씁니다.
  onboardingIconCircle: "#95DEB9",
  onboardingIconCircleSelected: "rgba(191, 235, 211, 0.75)",
  onboardingAccent: "#006D34",
  onboardingStep: "#0E8F50",
  onboardingStepInactive: "#B8B8B8",
  onboardingCardBorder: "#C1C6D7",
} as const;

export type ColorName = keyof typeof colors;
