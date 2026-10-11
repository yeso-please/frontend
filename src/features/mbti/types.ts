// 여행 MBTI 16유형. 유형 계산은 서버가 합니다 (온보딩 v2 mbtiAnswers → mbtiCode). 앱은 표시만 합니다.
export const MBTI_TYPES = [
  "ISTJ", "ISFJ", "INFJ", "INTJ",
  "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP",
  "ESTJ", "ESFJ", "ENFJ", "ENTJ",
] as const;

export type MbtiType = (typeof MBTI_TYPES)[number];

/** 서버가 준 mbtiCode가 우리가 아는 16유형인지 (null·구형 데이터는 false) */
export const isMbtiType = (code: string | null | undefined): code is MbtiType => !!code && (MBTI_TYPES as readonly string[]).includes(code);
