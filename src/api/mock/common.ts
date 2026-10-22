// 목업 서버 공통: 응답·오류 모양, 날짜 도우미.

export type Raw = { status: number; json: unknown };

/** 핸들러 안에서 던지면 라우터가 백엔드 공통 오류 응답으로 바꿉니다 */
export class MockError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra?: { fieldErrors?: { field: string; message: string }[]; details?: Record<string, unknown> },
  ) {
    super(message);
  }
}

export const ok = (json: unknown, status = 200): Raw => ({ status, json });
export const fail = (status: number, code: string, message: string, extra?: MockError["extra"]): Raw => ({
  status,
  json: { timestamp: new Date().toISOString(), status, code, message, ...extra },
});

export const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toYmd(d);
};
export const today = () => toYmd(new Date());
export const nowIso = () => new Date().toISOString().slice(0, 19);
export const isYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());
export const token = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
