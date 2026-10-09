import { useQuery } from "@tanstack/react-query";

import { regionApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import { shortRegionName } from "@/lib/josa";
import { useTripDraft } from "@/store/tripDraft";

/**
 * 지역 코드 → 화면용 짧은 이름("강릉").
 * 이번 준비 흐름에서 고른 지역이면 바로 쓰고, 아니면(예: 초대받아 들어온 여행) 지역 카드에서 이름을 가져옵니다.
 */
export function useRegionLabel(sigCd: string | null | undefined): string | null {
  const draftRegion = useTripDraft((s) => s.region);
  const fromDraft = draftRegion && draftRegion.sigCd === sigCd ? shortRegionName(draftRegion.province, draftRegion.city) : null;

  const card = useQuery({
    queryKey: queryKeys.regionCard(sigCd ?? ""),
    queryFn: () => regionApi.card(sigCd as string),
    enabled: !!sigCd && !fromDraft,
    staleTime: 60 * 60_000,
  });

  if (fromDraft) return fromDraft;
  return card.data ? shortRegionName(card.data.province, card.data.city) : null;
}
