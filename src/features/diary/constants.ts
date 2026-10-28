import type { DiaryVisibility, LocationPrecision } from "@/api/types";

// 여행기 6장 값 목록. 경험 태그는 백엔드 profile.md "경험 태그 사전" 그대로입니다 (이 밖의 값은 400).
export const EXPERIENCE_TAGS = ["자연", "바다", "산", "산책", "골목", "역사", "시장", "로컬 음식", "카페", "휴식", "실내", "체험"] as const;
export const MAX_EXPERIENCE_TAGS = 5;
export const MAX_PHOTOS = 30;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const TITLE_MAX = 60;
export const BODY_MAX = 5000;

export const VISIBILITY_OPTIONS: { value: DiaryVisibility; label: string; hint: string }[] = [
  { value: "PRIVATE", label: "나만", hint: "나만 볼 수 있어요." },
  { value: "FRIENDS", label: "친구", hint: "발행하면 친구의 여행 지도에 보여요." },
  { value: "LINK", label: "링크", hint: "발행한 뒤 공유 링크를 받은 사람만 볼 수 있어요." },
];

// rowLabel: 추가 화면 04 "사진 위치 공개" 줄에 보이는 이름. 서버 기본값은 CITY입니다 (trip.md 6-1).
// 서버는 공개용 사진 파일에서 EXIF를 지우고 촬영 시각·위치만 따로 둡니다 (6-2).
export const PRECISION_OPTIONS: { value: LocationPrecision; label: string; rowLabel: string; hint: string }[] = [
  { value: "CITY", label: "지역만", rowLabel: "시·군 단위 (기본)", hint: "다른 사람에게는 사진 위치를 지역 중심으로 보여 줘요." },
  { value: "EXACT", label: "정확히", rowLabel: "찍은 위치 그대로", hint: "다른 사람에게도 사진을 찍은 위치 그대로 보여 줘요." },
  { value: "HIDDEN", label: "숨김", rowLabel: "보여 주지 않음", hint: "다른 사람에게 사진 위치를 보여 주지 않아요." },
];
export const EXIF_NOTE = "사진 파일의 EXIF 촬영 정보는 지우고 저장해요.";

export const visibilityLabel = (v: DiaryVisibility) => VISIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? v;

export const SATISFACTION_LABELS = ["아쉬웠어요", "그저 그랬어요", "괜찮았어요", "좋았어요", "최고였어요"] as const;
