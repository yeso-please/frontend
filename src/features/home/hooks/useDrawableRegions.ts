import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { onboardingApi, regionApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { ScheduleDensity } from "@/api/types";

import { toMapRegion } from "../lib/regions";

// 홈 추첨은 여행(날짜)이 정해지기 전이라 days=1(당일)로 가능 여부를 봅니다.
// 긴 일정을 감당 못 하는 지역은 날짜 화면에서 GET /regions?days=N 으로 막습니다 (docs/app-architecture.md).
const DRAW_DAYS = 1;

/** 온보딩에서 고른 일정 밀도(없으면 RELAXED)로 추첨 가능한 지역 목록을 받아 지도 좌표를 붙입니다. */
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
    // 온보딩 결과를 못 받아도(오류) 기본 밀도로 진행합니다.
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
    isRefetching: regions.isRefetching,
    refetch: () => {
      if (onboarding.isError) onboarding.refetch();
      return regions.refetch();
    },
  };
}
