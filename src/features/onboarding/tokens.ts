import { colors } from "@/theme";

// 온보딩(402px) 디자인에만 있는 크기 값. 색은 src/theme/colors.ts의 onboarding* 토큰을 씁니다.
export const onboardingTokens = {
  /** 선택된 카드(green 채움) 위 아이콘 원 — 피그마 rgba(191,235,211,0.75) */
  selectedIconCircle: colors.onboardingIconCircleSelected,
  /** 7점 척도 노브 지름 (피그마 28) */
  knobSize: 28,
  /** 선택 노브 안쪽 흰 점 (피그마 10) */
  knobDot: 10,
  /** 선택된 쪽 라벨 앞 점 (피그마 8) */
  leanDot: 8,
  /** 카드 아이콘 원 (피그마 64 → 390 기준 56) */
  iconCircle: 56,
} as const;
