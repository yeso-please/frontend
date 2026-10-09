import type { TextStyle } from "react-native";

// Android는 fontWeight 대신 굵기별 fontFamily를 지정해야 합니다 (src/app/_layout.tsx에서 로드).
export const fonts = {
  regular: "NotoSansKR_400Regular",
  medium: "NotoSansKR_500Medium",
  bold: "NotoSansKR_700Bold",
  logo: "KeaniaOne_400Regular",
} as const;

const base: TextStyle = { includeFontPadding: false, color: "#202520" };

// 피그마 Text Style 6개 + 화면에서 반복되는 비토큰 크기를 이름 붙여 둡니다.
export const typography = {
  headline: { ...base, fontFamily: fonts.bold, fontSize: 30, lineHeight: 41 },
  title: { ...base, fontFamily: fonts.bold, fontSize: 26, lineHeight: 36 },
  cardTitle: { ...base, fontFamily: fonts.bold, fontSize: 20, lineHeight: 28 },
  label: { ...base, fontFamily: fonts.bold, fontSize: 16, lineHeight: 24 },
  body: { ...base, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 },
  caption: { ...base, fontFamily: fonts.medium, fontSize: 12, lineHeight: 18 },

  resultName: { ...base, fontFamily: fonts.bold, fontSize: 26, lineHeight: 32 },
  month: { ...base, fontFamily: fonts.bold, fontSize: 20, lineHeight: 30 },
  taskTitle: { ...base, fontFamily: fonts.bold, fontSize: 18, lineHeight: 27 },
  bodyMedium15: { ...base, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  bold14: { ...base, fontFamily: fonts.bold, fontSize: 14, lineHeight: 21 },
  small13: { ...base, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  small13Medium: { ...base, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20 },
  small13Bold: { ...base, fontFamily: fonts.bold, fontSize: 13, lineHeight: 20 },
  small12: { ...base, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  badge: { ...base, fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  tiny11: { ...base, fontFamily: fonts.regular, fontSize: 11, lineHeight: 18 },

  // 온보딩(402px) 디자인 전용
  onboardingTitle: { ...base, fontFamily: fonts.bold, fontSize: 28, lineHeight: 38 },
  onboardingSubtitle: { ...base, fontFamily: fonts.regular, fontSize: 16, lineHeight: 28 },

  logo: { fontFamily: fonts.logo, fontSize: 27, lineHeight: 36, letterSpacing: -1.3, color: "#202520" },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
