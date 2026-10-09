// 피그마 S2 · 경험 태그 & 제외 조건 (400:1456) 문구 그대로.
// 성향 점수와 무관한 추천 입력값이며, 앱 안(useMbtiStore)에만 저장합니다.

export const PREFERENCE_TAGS = ["자연", "바다", "산", "산책", "골목", "역사", "시장", "로컬 음식", "카페", "휴식", "실내", "체험", "전시", "야경", "사진", "쇼핑"] as const;

/** 피그마 Preference Tag 설명: 0–5 selected. When count=5, block additions and show limit feedback */
export const MAX_PREFERENCE_TAGS = 5;

export const EXCLUSION_TAGS = ["계단 / 경사 많은 곳", "장시간 걷기", "붐비는 곳", "야간 이동", "오래 기다리는 곳", "실내 위주", "장거리 이동", "강한 액티비티"] as const;
