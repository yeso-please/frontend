import type { TripSummary } from "@/api/types";
import { todayYmd } from "@/lib/date";

// 내 코스 탭(추가 화면 01)의 상태 — 다가오는 여행은 코스가 있으면 "완성", 없으면 "짜는 중", 끝난 여행은 "다녀옴".
export type CourseStatus = "PLANNING" | "DONE" | "PAST";
export type CourseFilter = "ALL" | CourseStatus;

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  PLANNING: "짜는 중",
  DONE: "완성",
  PAST: "다녀옴",
};

export const COURSE_FILTERS: { value: CourseFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "PLANNING", label: "짜는 중" },
  { value: "DONE", label: "완성" },
  { value: "PAST", label: "다녀옴" },
];

/** 종료일이 오늘보다 앞이면 다녀온 여행입니다 (3-6 PAST와 같은 기준) */
export function courseStatusOf(trip: Pick<TripSummary, "endDate" | "hasCourse">, today = todayYmd()): CourseStatus {
  if (trip.endDate < today) return "PAST";
  return trip.hasCourse ? "DONE" : "PLANNING";
}

export function countByStatus(trips: Pick<TripSummary, "endDate" | "hasCourse">[], today = todayYmd()): Record<CourseFilter, number> {
  const counts: Record<CourseFilter, number> = { ALL: trips.length, PLANNING: 0, DONE: 0, PAST: 0 };
  for (const t of trips) counts[courseStatusOf(t, today)] += 1;
  return counts;
}

/** 다가오는 여행은 가까운 날짜부터, 그 뒤에 다녀온 여행을 최근부터 */
export function sortForCourses<T extends Pick<TripSummary, "startDate" | "endDate">>(trips: T[], today = todayYmd()): T[] {
  const upcoming = trips.filter((t) => t.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = trips.filter((t) => t.endDate < today).sort((a, b) => b.startDate.localeCompare(a.startDate));
  return [...upcoming, ...past];
}
