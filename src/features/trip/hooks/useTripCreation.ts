import { useQueryClient } from "@tanstack/react-query";

import { tripApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { TripConflict, TripContext, Transport } from "@/api/types";
import { useTripDraft } from "@/store/tripDraft";

type Input = { startDate: string; nights: number; transport: Transport; sigCd: string };

export type CreationOutcome =
  | { kind: "done"; tripId: number }
  /** POST /trips/context/check 결과 날짜가 겹침 */
  | { kind: "conflict"; conflicts: TripConflict[] }
  /** 고른 지역이 이 기간 코스를 감당 못 함. rolledBack이면 방금 만든 여행을 지웠으니 기간을 다시 고르면 됩니다. */
  | { kind: "regionNotEligible"; rolledBack: boolean }
  | { kind: "error"; error: unknown };

/**
 * C · 날짜 선택 완료 흐름: 겹침 확인 → 여행 만들기 → 핀으로 고른 지역 저장(MANUAL).
 * 여행이 이미 만들어졌으면(tripId) 다시 만들지 않고 지역 저장만 확인합니다 (날짜는 만든 뒤 바꿀 수 없음).
 */
export function useTripCreation() {
  const queryClient = useQueryClient();

  const fetchContext = (tripId: number) =>
    queryClient.fetchQuery({ queryKey: queryKeys.tripContext(tripId), queryFn: () => tripApi.context(tripId), staleTime: 0 });

  const invalidateTrips = () => queryClient.invalidateQueries({ queryKey: ["trips"] });

  /** 지역이 아직 저장되지 않았으면 저장합니다. 버전 충돌(TRIP_VERSION_CONFLICT)이면 최신 버전을 받아 한 번 더 시도합니다. */
  async function ensureRegion(tripId: number, sigCd: string) {
    let ctx = await fetchContext(tripId);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (ctx.regionSigCd === sigCd) return;
      try {
        const res = await tripApi.decideRegion(tripId, { mode: "MANUAL", sigCd, version: ctx.version });
        queryClient.setQueryData<TripContext>(queryKeys.tripContext(tripId), (old) =>
          old ? { ...old, regionSigCd: res.regionSigCd, regionSelection: res.regionSelection, scheduleDensity: res.scheduleDensity, version: res.version } : old,
        );
        return;
      } catch (e) {
        if (!isApiError(e, "TRIP_VERSION_CONFLICT") || attempt > 0) throw e;
        ctx = await fetchContext(tripId);
      }
    }
  }

  /** 만들어진 여행을 준비 상태에 기록합니다 (다시 눌러도 중복 생성되지 않게). */
  const remember = (tripId: number, startDate: string, nights: number) => {
    const draft = useTripDraft.getState();
    draft.setDates(startDate, nights);
    draft.setTripId(tripId);
  };

  async function submit({ startDate, nights, transport, sigCd }: Input): Promise<CreationOutcome> {
    let tripId = useTripDraft.getState().tripId;
    let createdNow = false;
    try {
      if (tripId == null) {
        const check = await tripApi.check({ startDate, nights });
        if (!check.available) return { kind: "conflict", conflicts: check.conflicts };
        const ctx = await tripApi.create({ startDate, nights, transport });
        queryClient.setQueryData(queryKeys.tripContext(ctx.id), ctx);
        tripId = ctx.id;
        createdNow = true;
      }
      await ensureRegion(tripId, sigCd);
      remember(tripId, startDate, nights);
      void invalidateTrips();
      return { kind: "done", tripId };
    } catch (error) {
      if (tripId != null && isApiError(error, "DRAW_REGION_NOT_ELIGIBLE") && createdNow) {
        // 날짜는 바꿀 수 없으니 방금 만든 여행을 지우고(마지막 참여자가 나가면 삭제) 기간을 다시 고르게 합니다.
        try {
          await tripApi.leave(tripId);
          void invalidateTrips();
          return { kind: "regionNotEligible", rolledBack: true };
        } catch {
          remember(tripId, startDate, nights);
          return { kind: "regionNotEligible", rolledBack: false };
        }
      }
      if (tripId != null && createdNow) remember(tripId, startDate, nights);
      if (isApiError(error, "DRAW_REGION_NOT_ELIGIBLE")) return { kind: "regionNotEligible", rolledBack: false };
      return { kind: "error", error };
    }
  }

  /** 만든 여행을 지우고(나가기) 날짜를 다시 고를 수 있게 합니다. 지역·이동수단은 유지합니다. */
  async function discard(tripId: number) {
    await tripApi.leave(tripId);
    const { region, transport, reset, setRegion, setTransport } = useTripDraft.getState();
    reset();
    setRegion(region);
    setTransport(transport);
    queryClient.removeQueries({ queryKey: queryKeys.tripContext(tripId) });
    void invalidateTrips();
  }

  return { submit, discard };
}
