// 여행 준비 단계 (백엔드 docs/frontend-guide.md "준비 단계 계산").
// 여행 하나에 대해 앞에서부터 처음 안 된 단계가 "지금 할 일"입니다: 지역 → 날짜(여행이 있으면 완료) → 초대 → 코스.

export type PrepStep = "region" | "invite" | "course" | "done";

export type PrepInput = {
  regionSigCd: string | null;
  /** 참여자 수 (나 포함) */
  participantCount: number;
  /** 이 여행에서 보낸 친구 초대 수 (상태 무관, 4-14). 모르면 0 */
  sentInviteCount: number;
  hasCourse: boolean;
  /** 다녀온 여행 기록(사후 기록 여행)은 초대할 수 없어 초대 단계를 건너뜁니다 */
  retroactive?: boolean;
};

export function prepStep({ regionSigCd, participantCount, sentInviteCount, hasCourse, retroactive = false }: PrepInput): PrepStep {
  if (!regionSigCd) return "region";
  if (retroactive) return hasCourse ? "done" : "course";
  // "혼자 여행할게요"로 넘어가 코스까지 만든 여행은 초대 단계를 지난 것으로 봅니다 (안 그러면 혼자 가는 여행이 계속 "친구 초대 중").
  if (participantCount < 2 && sentInviteCount === 0 && !hasCourse) return "invite";
  if (!hasCourse) return "course";
  return "done";
}

/** 홈 카드 상태 칩 문구 */
export const PREP_STEP_LABEL: Record<PrepStep, string> = {
  region: "지역 고르는 중",
  invite: "친구 초대 중",
  course: "코스 만드는 중",
  done: "코스 완성",
};

/** "이어서 준비하기"가 여는 화면 — 초대 단계면 친구 초대, 나머지는 코스 화면(지역 없는 옛 여행도 코스 화면이 안내합니다) */
export function prepStepHref(tripId: number, step: PrepStep) {
  return step === "invite"
    ? ({ pathname: "/trip/[tripId]/invite", params: { tripId: String(tripId) } } as const)
    : ({ pathname: "/trip/[tripId]", params: { tripId: String(tripId) } } as const);
}
