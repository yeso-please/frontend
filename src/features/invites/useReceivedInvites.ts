import { useQuery } from "@tanstack/react-query";

import { inviteApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";

/** 4-7 받은 여행 초대. 알림 벨 숫자 = 배열 길이 (D15). 홈·여행 탭 상단 벨이 함께 씁니다. */
export function useReceivedInvites() {
  return useQuery({ queryKey: queryKeys.receivedInvites, queryFn: inviteApi.received, staleTime: 30_000 });
}

export function useReceivedInviteCount() {
  return useReceivedInvites().data?.length ?? 0;
}
