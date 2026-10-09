// 날짜는 백엔드 규약대로 "YYYY-MM-DD" 문자열로 다룹니다 (시간대 없음).
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export const parseYmd = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const toYmd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const addDays = (ymd: string, days: number) => {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
};

export const diffDays = (from: string, to: string) => Math.round((parseYmd(to).getTime() - parseYmd(from).getTime()) / 86400000);

export const todayYmd = () => toYmd(new Date());

/** "10월 17일 (토)" */
export const formatLong = (ymd: string) => {
  const d = parseYmd(ymd);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
};

/** "10.17 (토)" */
export const formatShort = (ymd: string) => {
  const d = parseYmd(ymd);
  return `${d.getMonth() + 1}.${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
};

/** "10.17 (토) – 10.19 (월)" */
export const formatRange = (start: string, end: string) => (start === end ? formatShort(start) : `${formatShort(start)} – ${formatShort(end)}`);

/** 박수 → "당일" / "2박 3일" */
export const formatNights = (nights: number) => (nights === 0 ? "당일" : `${nights}박 ${nights + 1}일`);
