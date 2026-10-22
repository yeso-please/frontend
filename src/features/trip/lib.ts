import type { DateRange, TripConflict } from "@/api/types";
import { addDays, diffDays, parseYmd, toYmd } from "@/lib/date";
import { shortRegionName } from "@/lib/josa";

// 여행 준비 흐름에서만 쓰는 날짜·라우트 도우미. 날짜는 모두 "YYYY-MM-DD" 문자열입니다.

/** 그 달 1일의 id ("2026-10-01") */
export const monthIdOf = (ymd: string) => `${ymd.slice(0, 7)}-01`;

/** 달 이동 (delta: -1 이전 달, +1 다음 달) */
export const shiftMonth = (monthId: string, delta: number) => {
  const d = parseYmd(monthId);
  return toYmd(new Date(d.getFullYear(), d.getMonth() + delta, 1));
};

/** 그 달 마지막 날 */
export const monthEndOf = (monthId: string) => {
  const d = parseYmd(monthId);
  return toYmd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

/** "2026년 10월" */
export const formatMonthTitle = (monthId: string) => {
  const d = parseYmd(monthId);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
};

/** 일요일 시작 7열 달력. 그 달이 아닌 칸은 null 입니다. */
export function buildMonthGrid(monthId: string): (string | null)[][] {
  const first = parseYmd(monthId);
  const lead = first.getDay();
  const days = parseYmd(monthEndOf(monthId)).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < days; i += 1) cells.push(addDays(monthId, i));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 시작~종료 포함 일수 (당일 = 1) */
export const inclusiveDays = (start: string, end: string) => diffDays(start, end) + 1;

/** 다가오는 주말의 토요일 (minDate 이후 첫 토요일) */
export function nextSaturday(minDate: string) {
  const offset = (6 - parseYmd(minDate).getDay() + 7) % 7;
  return addDays(minDate, offset);
}

export const isSaturday = (ymd: string) => parseYmd(ymd).getDay() === 6;

/** 기간 목록을 날짜 집합으로 펼칩니다 (캘린더 비활성 표시용). excludeTripId 여행은 빼고 셉니다. */
export function expandRanges(ranges: DateRange[] | undefined, excludeTripId?: number | null) {
  const set = new Set<string>();
  for (const r of ranges ?? []) {
    if (excludeTripId != null && r.tripId === excludeTripId) continue;
    const span = diffDays(r.startDate, r.endDate);
    for (let i = 0; i <= span; i += 1) set.add(addDays(r.startDate, i));
  }
  return set;
}

/** start~end 사이에 막힌 날이 하나라도 있는지 */
export function rangeHitsBlocked(start: string, end: string, blocked: Set<string>) {
  const span = diffDays(start, end);
  for (let i = 0; i <= span; i += 1) if (blocked.has(addDays(start, i))) return true;
  return false;
}

/** ApiError.details.conflicts 를 안전하게 꺼냅니다 */
export function conflictsFromDetails(details: Record<string, unknown> | undefined): TripConflict[] {
  const raw = details?.conflicts;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is TripConflict => typeof c === "object" && c !== null && typeof (c as TripConflict).startDate === "string" && typeof (c as TripConflict).endDate === "string",
  );
}

/** 긴 문장을 앞부분만 보여줍니다 ("자연을 매우 선호, 체험 활동을…") */
export const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

/** 서버의 regionName("강원특별자치도 강릉시") → 화면용 짧은 이름("강릉"). 지역 전이면 null */
export function regionLabelFromName(regionName: string | null | undefined): string | null {
  const words = regionName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) return null;
  if (words.length === 1) return shortRegionName("", words[0]);
  return shortRegionName(words[0], words.slice(1).join(" "));
}

/** 여행 카드 제목 "강릉 여행". 지역 전이면 서버가 준 대체 제목("10월 10일부터 2박 3일 여행") */
export const tripCardTitle = (regionName: string | null | undefined, fallbackTitle: string) => {
  const label = regionLabelFromName(regionName);
  return label ? `${label} 여행` : fallbackTitle;
};

/** 닉네임 목록 → "수정 · 서현" (많으면 "수정 · 서현 외 2명") */
export function joinNicknames(nicknames: string[], max = 3) {
  if (nicknames.length <= max) return nicknames.join(" · ");
  return `${nicknames.slice(0, max).join(" · ")} 외 ${nicknames.length - max}명`;
}

/** "10.17 – 10.19" (요일 없이, 홈 카드용). 당일이면 "10.17" */
export function formatDotRange(start: string, end: string) {
  const dot = (ymd: string) => {
    const d = parseYmd(ymd);
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };
  return start === end ? dot(start) : `${dot(start)} – ${dot(end)}`;
}
