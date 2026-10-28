import { linkPeriod, linkState, sortLinks } from "@/features/share/linkState";

// 보낸 링크 상태: 서버 시각(Asia/Seoul, 시간대 없음)을 한국 시각으로 읽어 만료를 가립니다.
const NOW = Date.parse("2026-10-29T12:00:00+09:00");
const link = (id: number, expiresAt: string, revoked = false, createdAt = "2026-10-22T09:00:00") => ({ id, expiresAt, revoked, createdAt });

describe("linkState", () => {
  it("취소 > 만료 > 사용 중", () => {
    expect(linkState(link(1, "2026-11-05T12:00:00", true), NOW)).toBe("REVOKED");
    expect(linkState(link(2, "2026-10-29T11:59:59"), NOW)).toBe("EXPIRED");
    expect(linkState(link(3, "2026-10-29T12:00:01"), NOW)).toBe("ACTIVE");
  });

  it("보낸 날과 끝나는 날을 보여 준다", () => {
    expect(linkPeriod(link(1, "2026-11-05T12:00:00"), NOW)).toBe("10.22에 보냄 · 11.5까지");
    expect(linkPeriod(link(2, "2026-10-28T12:00:00"), NOW)).toBe("10.22에 보냄 · 10.28에 만료");
  });

  it("사용 중인 링크를 먼저, 그 안에서는 최신순", () => {
    const sorted = sortLinks([link(1, "2026-11-05T12:00:00"), link(2, "2026-10-01T00:00:00"), link(3, "2026-11-06T00:00:00"), link(4, "2026-11-07T00:00:00", true)], NOW);
    expect(sorted.map((l) => l.id)).toEqual([3, 1, 4, 2]);
  });
});
