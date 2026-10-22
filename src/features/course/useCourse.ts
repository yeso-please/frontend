import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";

import { courseApi, tripApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { Course, ScheduleOperation } from "@/api/types";
import { haptics } from "@/lib/haptics";

// 코스(5-2) 조회·편집(5-3)·생성(5-1) 훅. 장소 편집·식사·지도 화면도 이 훅으로 같은 캐시를 씁니다.
// 모든 편집은 받은 version을 그대로 보내고, 409 TRIP_VERSION_CONFLICT면 최신 코스를 다시 받습니다.

const noRetryCodes = ["COURSE_NOT_FOUND", "TRIP_NOT_FOUND"];

/**
 * 5-2 코스. 코스가 아직 없으면 error가 ApiError(COURSE_NOT_FOUND)입니다.
 * poll: 친구 편집을 보려고 주기적으로 다시 받을 간격(ms) — 함수면 매번 다시 물어봅니다 (드래그 중엔 false)
 */
export function useCourse(tripId: number, options?: { enabled?: boolean; poll?: number | false | (() => number | false) }) {
  const poll = options?.poll ?? false;
  return useQuery({
    queryKey: queryKeys.course(tripId),
    queryFn: () => courseApi.get(tripId),
    enabled: (options?.enabled ?? true) && Number.isFinite(tripId),
    retry: (count, e) => !noRetryCodes.some((code) => isApiError(e, code)) && count < 2,
    refetchInterval: (query) => (query.state.error ? false : typeof poll === "function" ? poll() : poll),
  });
}

export type CourseEditInput =
  | ScheduleOperation[]
  | {
      operations: ScheduleOperation[];
      /** 응답 전에 화면을 먼저 바꿀 때 (드래그 순서 변경). 실패하면 원래 코스로 돌립니다 */
      optimistic?: (course: Course) => Course;
    };

const normalize = (input: CourseEditInput) => (Array.isArray(input) ? { operations: input, optimistic: undefined } : input);

/** 같은 여행 버전을 쓰는 캐시(여행 context·목록)를 함께 새로 고칩니다 */
function useInvalidateTrip(tripId: number) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tripContext(tripId) });
    void queryClient.invalidateQueries({ queryKey: ["trips", "all"] });
    void queryClient.invalidateQueries({ queryKey: ["trips", "UPCOMING"] });
  };
}

/** 5-3 일정 편집. mutate([...ops]) 또는 mutate({ operations, optimistic }) */
export function useCourseEdit(tripId: number) {
  const queryClient = useQueryClient();
  const invalidateTrip = useInvalidateTrip(tripId);
  const key = queryKeys.course(tripId);

  return useMutation({
    mutationFn: async (input: CourseEditInput) => {
      const { operations } = normalize(input);
      // 낙관적 반영 전에 기억해 둔 version을 씁니다 (onMutate가 캐시를 바꿔도 version은 그대로입니다)
      const current = queryClient.getQueryData<Course>(key) ?? (await courseApi.get(tripId));
      return courseApi.edit(tripId, current.version, operations);
    },
    onMutate: async (input) => {
      const { optimistic } = normalize(input);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Course>(key);
      if (optimistic && previous) queryClient.setQueryData<Course>(key, optimistic(previous));
      return { previous };
    },
    onSuccess: (course) => {
      queryClient.setQueryData(key, course);
      invalidateTrip();
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      haptics.reject();
      if (isApiError(error, "TRIP_VERSION_CONFLICT")) {
        void queryClient.invalidateQueries({ queryKey: key });
        invalidateTrip();
        toast("다른 참여자가 먼저 바꿨어요. 최신 코스로 다시 불러왔어요");
      }
    },
  });
}

/** 5-1 코스 생성·재생성. tasteMode는 보내지 않아 요청자의 설정(B4 "내 여행 성향 반영 / 완전 랜덤")을 씁니다 */
export function useGenerateCourse(tripId: number) {
  const queryClient = useQueryClient();
  const invalidateTrip = useInvalidateTrip(tripId);
  return useMutation({
    mutationFn: async () => {
      // 코스가 없으면 5-2가 404라 version은 여행 context에서 받습니다 (두 값은 같은 여행 버전입니다)
      const ctx = await queryClient.fetchQuery({ queryKey: queryKeys.tripContext(tripId), queryFn: () => tripApi.context(tripId), staleTime: 0 });
      return courseApi.generate(tripId, { version: ctx.version });
    },
    onSuccess: (course) => {
      queryClient.setQueryData(queryKeys.course(tripId), course);
      invalidateTrip();
      haptics.confirm();
    },
    onError: (error) => {
      haptics.reject();
      if (isApiError(error, "TRIP_VERSION_CONFLICT")) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.course(tripId) });
        invalidateTrip();
      }
    },
  });
}
