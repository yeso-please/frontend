import { errorMessage, isApiError } from "@/api/errors";

/** 초대 링크를 더 열 수 없는 경우 (만료·폐기·없음·다른 용도) */
export const isDeadInvite = (e: unknown) =>
  isApiError(e, "INVITE_EXPIRED") || isApiError(e, "INVITE_REVOKED") || isApiError(e, "INVITE_NOT_FOUND") || isApiError(e, "TOKEN_AUDIENCE_MISMATCH");

export function deadInviteText(e: unknown) {
  if (isApiError(e, "INVITE_EXPIRED")) return { title: "초대 기간이 지났어요", description: "초대한 친구에게 새 링크를 요청해 주세요." };
  if (isApiError(e, "INVITE_REVOKED")) return { title: "더 이상 쓸 수 없는 초대예요", description: "초대한 친구가 링크를 거둬들였어요. 새 링크를 요청해 주세요." };
  return { title: "초대를 찾을 수 없어요", description: "링크가 정확한지 확인하거나 새 링크를 요청해 주세요." };
}

/** 수락(4-5·4-8) 실패를 한 줄 안내로 */
export function acceptErrorMessage(e: unknown) {
  if (isApiError(e, "TRIP_DATE_OVERLAP")) return "내 다른 여행과 날짜가 겹쳐요. 그 여행에서 나온 뒤 다시 수락해 주세요.";
  if (isApiError(e, "TRIP_FULL")) return "참여 인원(8명)이 꽉 찬 여행이에요.";
  if (isApiError(e, "TRIP_ENDED")) return "이미 끝난 여행이라 참여할 수 없어요.";
  if (isApiError(e, "INVITE_ALREADY_HANDLED")) return "이미 응답했거나 취소된 초대예요.";
  if (isDeadInvite(e)) return deadInviteText(e).title;
  return errorMessage(e);
}
