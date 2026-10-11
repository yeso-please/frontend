import { addDays, diffDays, formatLong, formatNights, formatRange, formatShort, parseYmd, toYmd } from "@/lib/date";
import { shortRegionName, withEulReul, withEunNeun, withEuro, withIGa } from "@/lib/josa";

describe("josa", () => {
  it("받침과 ㄹ 받침에 맞춰 '으로/로'를 고릅니다", () => {
    expect(withEuro("강릉")).toBe("강릉으로");
    expect(withEuro("경주")).toBe("경주로");
    expect(withEuro("서울")).toBe("서울로");
    expect(withEuro("TriPin")).toBe("TriPin로");
  });

  it("은/는, 이/가, 을/를", () => {
    expect(withEunNeun("강릉")).toBe("강릉은");
    expect(withEunNeun("경주")).toBe("경주는");
    expect(withIGa("부산")).toBe("부산이");
    expect(withIGa("제주")).toBe("제주가");
    expect(withEulReul("전주")).toBe("전주를");
  });

  it("지역 표시 이름을 짧게 만듭니다", () => {
    expect(shortRegionName("강원특별자치도", "강릉시")).toBe("강릉");
    expect(shortRegionName("강원특별자치도", "고성군")).toBe("고성");
    expect(shortRegionName("경기도", "수원시장안구")).toBe("수원 장안구");
    expect(shortRegionName("경기도", "수원시 장안구")).toBe("수원 장안구");
    expect(shortRegionName("서울특별시", "종로구")).toBe("서울 종로구");
    expect(shortRegionName("부산광역시", "해운대구")).toBe("부산 해운대구");
  });
});

describe("date", () => {
  it("월·연도 경계를 넘어 날짜를 더합니다", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(diffDays("2026-10-17", "2026-10-19")).toBe(2);
  });

  it("YYYY-MM-DD 왕복이 깨지지 않습니다", () => {
    expect(toYmd(parseYmd("2026-01-05"))).toBe("2026-01-05");
  });

  it("피그마 표기대로 날짜를 씁니다", () => {
    expect(formatLong("2026-10-17")).toBe("10월 17일 (토)");
    expect(formatShort("2026-10-19")).toBe("10.19 (월)");
    expect(formatRange("2026-10-17", "2026-10-19")).toBe("10.17 (토) – 10.19 (월)");
    expect(formatRange("2026-10-17", "2026-10-17")).toBe("10.17 (토)");
    expect(formatNights(0)).toBe("당일");
    expect(formatNights(2)).toBe("2박 3일");
  });
});
