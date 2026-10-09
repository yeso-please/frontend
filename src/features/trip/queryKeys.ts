// 여행 준비 흐름 전용 쿼리 키. 공용 키(@/api/queryKeys)와 같은 접두사 규칙을 따릅니다.
export const tripFlowKeys = {
  /** 참여자 + 보낸 친구 초대를 한 번에 받는 폴링용 키 (두 목록이 한 번에 바뀌어야 행 이동 애니메이션이 자연스럽습니다) */
  travelers: (tripId: number) => ["trips", tripId, "travelers"] as const,
  /**
   * 초대 링크 발급(POST) 결과. token 원문은 발급 응답에서만 받을 수 있어 한 번 받은 값을 계속 씁니다.
   * "trips" 접두사 무효화로 다시 발급(POST)되지 않도록 일부러 다른 접두사를 씁니다.
   */
  inviteLink: (tripId: number) => ["invite-link", tripId] as const,
};
