import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { onboardingApi, regionApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { ScheduleDensity } from "@/api/types";

import { toMapRegion } from "../lib/regions";

// 지역 먼저 흐름(D1)은 날짜를 모를 때 1일 기준으로 뽑습니다 (7-5와 같은 기준).
// 직접 고르기 목록과 핀이 "찾는 중"에 들르는 자리에 씁니다. 실제 추첨은 서버(POST /regions/draw)가 합니다.
const DRAW_DAYS = 1;

/** 최신 설문의 일정 밀도(없으면 RELAXED)로 1일 기준 추첨 가능한 지역을 받아 지도 좌표를 붙입니다. */
export function useDrawableRegions() {
  const onboarding = useQuery({
    queryKey: queryKeys.myOnboarding,
    queryFn: onboardingApi.me,
    staleTime: 5 * 60_000,
  });
  const density: ScheduleDensity = onboarding.data?.submission?.scheduleDensity ?? "RELAXED";

  const regions = useQuery({
    queryKey: queryKeys.regions(DRAW_DAYS, density),
    queryFn: () => regionApi.list({ days: DRAW_DAYS, scheduleDensity: density }),
    // 설문 결과를 못 받아도(오류) 기본 밀도로 진행합니다.
    enabled: !onboarding.isPending,
    staleTime: 10 * 60_000,
  });

  const eligible = useMemo(
    () => (regions.data?.regions ?? []).filter((r) => r.drawEligible === true).map(toMapRegion),
    [regions.data],
  );

  return {
    eligible,
    isPending: onboarding.isPending || regions.isPending,
    isError: regions.isError,
    error: regions.error,
    refetch: () => {
      if (onboarding.isError) onboarding.refetch();
      return regions.refetch();
    },
  };
}
