import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { tripApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useTripDraft } from "@/store/tripDraft";

/**
 * 준비 상태에 남은 tripId가 지금 고른 지역의 여행이 아니면(예: 예전 준비를 마치지 않고 홈에서 새 핀을 꽂음) 여행 부분만 비웁니다.
 * 그대로 두면 날짜 화면이 예전 여행의 지역을 새 지역으로 덮어쓸 수 있기 때문입니다. 없어진 여행(TRIP_NOT_FOUND)도 같습니다.
 */
export function useStaleDraftGuard() {
  const tripId = useTripDraft((s) => s.tripId);
  const region = useTripDraft((s) => s.region);
  const context = useQuery({
    queryKey: queryKeys.tripContext(tripId ?? 0),
    queryFn: () => tripApi.context(tripId as number),
    enabled: tripId != null,
  });

  const regionMismatch = !!region && !!context.data?.regionSigCd && context.data.regionSigCd !== region.sigCd;
  const gone = context.isError && isApiError(context.error, "TRIP_NOT_FOUND");
  const stale = tripId != null && (regionMismatch || gone);

  useEffect(() => {
    if (!stale) return;
    const { region: keep, transport, reset, setRegion, setTransport } = useTripDraft.getState();
    reset();
    setRegion(keep);
    setTransport(transport);
  }, [stale]);
}
