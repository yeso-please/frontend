import type { Transport } from "@/api/types";

/** 백엔드 규칙: 당일(0박)부터 최대 6박 7일 */
export const MAX_TRIP_DAYS = 7;

/** 피그마 Calendar · Date cell 최소 터치 높이 */
export const CALENDAR_CELL_HEIGHT = 44;

/** 피그마 Preparation/Progress 막대 높이 (r3) */
export const PROGRESS_SEGMENT_HEIGHT = 6;

/** 피그마 Invitation/Avatar 지름 */
export const AVATAR_SIZE = 40;

/** 피그마 Task Card 심볼 크기 */
export const TASK_SYMBOL_SIZE = 44;

/** Current 상태 카드·선택 프리셋 보더 굵기 */
export const EMPHASIS_BORDER = 1.5;

/** 친구 초대 화면 참여자·초대 목록 새로고침 주기 (화면이 보일 때만) */
export const TRAVELERS_POLL_MS = 5000;

export type DurationPreset = { key: "day" | "1n" | "2n" | "weekend"; label: string; nights: number };

/** 피그마 Calendar/Duration preset — "주말"은 다가오는 토요일부터 1박 2일 */
export const DURATION_PRESETS: DurationPreset[] = [
  { key: "day", label: "당일", nights: 0 },
  { key: "1n", label: "1박 2일", nights: 1 },
  { key: "2n", label: "2박 3일", nights: 2 },
  { key: "weekend", label: "주말", nights: 1 },
];

/** POST /trips 필수값이지만 피그마에 없는 항목 — 디자이너 검토 필요 */
export const TRANSPORT_OPTIONS: { value: Transport; label: string }[] = [
  { value: "PUBLIC_TRANSIT", label: "대중교통" },
  { value: "CAR", label: "자동차" },
  { value: "WALK", label: "도보" },
];

