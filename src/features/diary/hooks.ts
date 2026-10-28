import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { toast } from "sonner-native";

import { diaryApi, travelMapApi } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { Diary } from "@/api/types";
import { haptics } from "@/lib/haptics";

export function useDiary(diaryId: number) {
  return useQuery({ queryKey: queryKeys.diary(diaryId), queryFn: () => diaryApi.get(diaryId), enabled: Number.isFinite(diaryId) });
}

export function useMyTravelMap() {
  return useQuery({ queryKey: queryKeys.myTravelMap, queryFn: () => travelMapApi.mine() });
}

/**
 * 내 여행 → 여행기 ID. 백엔드 3-6의 myDiaryId가 아직 채워지지 않고 지도 핀(6-7)에는 tripId가 없어,
 * 핀마다 여행기를 조회해 tripId를 맞춥니다 (_local/backend-requests.md 4번). 여행기 수가 적어 부담이 작습니다.
 */
export function useDiaryIdsByTrip() {
  const map = useMyTravelMap();
  const pins = map.data ?? [];
  const diaries = useQueries({
    queries: pins.map((p) => ({ queryKey: queryKeys.diary(p.diaryId), queryFn: () => diaryApi.get(p.diaryId), staleTime: 60_000 })),
  });
  const byTrip = new Map<number, number>();
  diaries.forEach((q) => {
    if (q.data) byTrip.set(q.data.tripId, q.data.diaryId);
  });
  return { byTrip, isPending: map.isPending || diaries.some((q) => q.isPending), isError: map.isError, refetch: map.refetch };
}

/** 지도·목록을 다시 받게 합니다 (여행기를 만들거나 지운 뒤) */
export function useInvalidateDiaries() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.myTravelMap });
    void queryClient.invalidateQueries({ queryKey: ["trips"] });
  };
}

/**
 * "여행기 쓰기": 끝난 여행에 여행기(초안)를 만들고 편집 화면으로 갑니다.
 * 이미 있으면(409 DIARY_ALREADY_EXISTS_FOR_TRIP) 그 여행기를 엽니다.
 */
export function useStartDiary() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateDiaries();
  return useMutation({
    mutationFn: (tripId: number) => diaryApi.create(tripId),
    onSuccess: (diary: Diary) => {
      haptics.confirm();
      queryClient.setQueryData(queryKeys.diary(diary.diaryId), diary);
      invalidate();
      router.push({ pathname: "/diary/[diaryId]/edit", params: { diaryId: String(diary.diaryId) } });
    },
    onError: (e) => {
      if (isApiError(e, "DIARY_ALREADY_EXISTS_FOR_TRIP") && typeof e.details.diaryId === "number") {
        router.push({ pathname: "/diary/[diaryId]", params: { diaryId: String(e.details.diaryId) } });
        return;
      }
      haptics.reject();
      toast(isApiError(e, "TRIP_NOT_ENDED") ? "여행이 끝난 다음 날부터 여행기를 쓸 수 있어요" : errorMessage(e));
    },
  });
}
