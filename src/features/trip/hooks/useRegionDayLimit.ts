import { useQueries, useQuery } from "@tanstack/react-query";

import { onboardingApi, regionApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { RegionList } from "@/api/types";

import { MAX_TRIP_DAYS } from "../constants";

const DAYS = Array.from({ length: MAX_TRIP_DAYS }, (_, i) => i + 1);
const REGION_STALE_MS = 10 * 60_000;

export type RegionDayLimit =
  /** 아직 확인 중 (확인된 만큼의 하한 knownDays) */
  | { status: "loading"; maxDays: number; knownDays: number }
  /** 확인 완료. maxDays = 이 지역으로 코스를 만들 수 있는 최대 일수 (0이면 당일도 불가) */
  | { status: "ready"; maxDays: number }
  /** 조회 실패 → 앱에서는 7일까지 허용하고 서버(DRAW_REGION_NOT_ELIGIBLE)가 최종 판단 */
  | { status: "unknown"; maxDays: number };

/**
 * 디자이너 메모 415:761 "몇 박 몇일 고르고 → 핀 꽂히는 지역 제한?"
 * 핀으로 고른 지역이 며칠짜리 코스까지 감당하는지 GET /regions?days=1..7 을 병렬로 받아 계산합니다.
 * 일정 밀도는 서버가 지역을 정할 때 쓰는 값(내 설문의 scheduleDensity)과 맞춥니다.
 */
export function useRegionDayLimit(sigCd: string | null | undefined): RegionDayLimit {
  const onboarding = useQuery({ queryKey: queryKeys.myOnboarding, queryFn: onboardingApi.me, staleTime: REGION_STALE_MS });
  const density = onboarding.data?.submission?.scheduleDensity;
  const densitySettled = onboarding.isSuccess || onboarding.isError;

  const results = useQueries({
    queries: DAYS.map((days) => ({
      queryKey: queryKeys.regions(days, density),
      queryFn: () => regionApi.list({ days, scheduleDensity: density }),
      enabled: !!sigCd && densitySettled,
      staleTime: REGION_STALE_MS,
      select: (list: RegionList) => list.regions.find((r) => r.sigCd === sigCd)?.drawEligible ?? null,
    })),
  });

  if (!sigCd) return { status: "unknown", maxDays: MAX_TRIP_DAYS };

  // 1일부터 차례로 보며 처음 막히는 일수 직전까지가 최대 일수입니다.
  let maxDays = 0;
  for (const result of results) {
    if (result.isError || (result.isSuccess && result.data === null)) return { status: "unknown", maxDays: MAX_TRIP_DAYS };
    if (!result.isSuccess) return { status: "loading", maxDays: MAX_TRIP_DAYS, knownDays: maxDays };
    if (!result.data) return { status: "ready", maxDays };
    maxDays += 1;
  }
  return { status: "ready", maxDays };
}
