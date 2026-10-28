// 보낸 링크(친구 초대·여행 초대·코스 공유·여행기 공유)의 상태. 서버 시각은 Asia/Seoul LocalDateTime("2026-10-29T12:00:00")입니다.

export type LinkState = "ACTIVE" | "EXPIRED" | "REVOKED";
export type SentLinkLike = { id: number; expiresAt: string; revoked: boolean; createdAt: string };

export const LINK_STATE_LABEL: Record<LinkState, string> = {
  ACTIVE: "사용 중",
  EXPIRED: "만료",
  REVOKED: "취소됨",
};

/** 시간대 없는 서버 시각을 한국 시각으로 읽습니다 (기기 시간대와 상관없이) */
const seoulTime = (ymdhms: string) => Date.parse(`${ymdhms.slice(0, 19)}+09:00`);

export function linkState(link: Pick<SentLinkLike, "expiresAt" | "revoked">, now = Date.now()): LinkState {
  if (link.revoked) return "REVOKED";
  return seoulTime(link.expiresAt) <= now ? "EXPIRED" : "ACTIVE";
}

/** "10.29" */
export const monthDay = (ymdhms: string) => `${Number(ymdhms.slice(5, 7))}.${Number(ymdhms.slice(8, 10))}`;

/** "10.29에 보냄 · 11.5까지" / "10.29에 보냄 · 11.5에 만료" */
export function linkPeriod(link: SentLinkLike, now = Date.now()) {
  const state = linkState(link, now);
  const end = state === "EXPIRED" ? `${monthDay(link.expiresAt)}에 만료` : `${monthDay(link.expiresAt)}까지`;
  return `${monthDay(link.createdAt)}에 보냄 · ${end}`;
}

/** 사용 중인 링크를 먼저, 그 안에서는 최신순 */
export function sortLinks<T extends SentLinkLike>(links: T[], now = Date.now()): T[] {
  const rank = (l: T) => (linkState(l, now) === "ACTIVE" ? 0 : 1);
  return [...links].sort((a, b) => rank(a) - rank(b) || b.id - a.id);
}
