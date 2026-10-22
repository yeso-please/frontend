import type { AttractionItem, Course, CourseDay, MealItem, TravelLeg } from "@/api/types";
import {
  changeLabel,
  dayChangeSummary,
  formatDistance,
  formatMinutes,
  itemDescription,
  latestChangeSentence,
  presenceSentence,
  replacedLine,
  transitDetail,
  travelModes,
  travelSummary,
  tripTitle,
} from "@/features/course/format";
import { applyMove, canMove, dropPosition, moveItem } from "@/features/course/reorder";

const leg = (over: Partial<TravelLeg> = {}): TravelLeg => ({
  meters: 1786,
  walkMinutes: 33,
  carMinutes: 5,
  transitMinutes: 6,
  carSource: "STRAIGHT",
  walkSource: "STRAIGHT",
  transitSource: "STRAIGHT",
  transitTransfers: null,
  transitFare: null,
  estimated: true,
  ...over,
});

const place = (itemId: string, name: string, over: Partial<AttractionItem> = {}): AttractionItem => ({
  itemId,
  type: "ATTRACTION",
  attractionId: Number(itemId.slice(2)),
  name,
  category: "NATURE",
  thumbnailUrl: null,
  address: null,
  lat: 0,
  lng: 0,
  durationMinutes: 90,
  travelFromPreviousMinutes: null,
  travelFromPreviousMeters: null,
  travelFromPrevious: leg(),
  estimated: true,
  source: "RECOMMEND",
  reason: null,
  reasonSource: null,
  personalReason: null,
  oneLine: null,
  summaryBasis: null,
  change: { origin: "BASE", by: null, replacedFrom: null, note: null, changedAt: null },
  ...over,
});

const meal = (itemId: string, kind: "LUNCH" | "DINNER"): MealItem => ({
  itemId,
  type: "MEAL",
  meal: kind,
  durationMinutes: 60,
  travelFromPreviousMinutes: null,
  travelFromPreviousMeters: null,
  travelFromPrevious: null,
  restaurant: null,
});

describe("이동 시간 표시 (D5)", () => {
  it("분·거리를 읽기 쉽게 씁니다", () => {
    expect(formatMinutes(5)).toBe("5분");
    expect(formatMinutes(75)).toBe("1시간 15분");
    expect(formatMinutes(120)).toBe("2시간");
    expect(formatDistance(650)).toBe("650m");
    expect(formatDistance(1786)).toBe("1.8km");
    expect(formatDistance(2000)).toBe("2km");
    expect(formatDistance(12345)).toBe("12km");
  });

  it("세 수단을 도보·자동차·대중교통 순서로, 직선 추정이면 '약'을 붙입니다", () => {
    const modes = travelModes(leg({ carSource: "ROAD", carMinutes: 7 }));
    expect(modes.map((m) => m.text)).toEqual(["약 33분", "7분", "약 6분"]);
    expect(modes.map((m) => m.label)).toEqual(["도보", "자동차", "대중교통"]);
  });

  it("그날 첫 지점(leg null)은 표시하지 않습니다", () => {
    expect(travelModes(null)).toEqual([]);
    expect(travelSummary(null, "CAR")).toBeNull();
  });

  it("여행 이동수단을 기본으로 요약합니다", () => {
    expect(travelSummary(leg(), "CAR")).toBe("자동차 약 5분 · 1.8km");
    expect(travelSummary(leg(), "WALK")).toBe("도보 약 33분 · 1.8km");
  });

  it("대중교통 실제 경로일 때만 환승·요금을 보여 줍니다", () => {
    expect(transitDetail(leg())).toBeNull();
    expect(transitDetail(leg({ transitSource: "ROUTE", transitTransfers: 0, transitFare: 1500 }))).toBe("환승 없음 · 1,500원");
    expect(transitDetail(leg({ transitSource: "ROUTE", transitTransfers: 2, transitFare: null }))).toBe("환승 2회");
  });
});

describe("변경 기록 문구 (D11)", () => {
  it("카드 라벨은 change.origin으로 정합니다", () => {
    expect(changeLabel(place("a-1", "안목해변"))).toEqual({ text: "기본 추천", tone: "base" });
    const added = place("a-2", "테라로사", { change: { origin: "ADDED", by: { userId: 2, nickname: "민지" }, replacedFrom: null, note: null, changedAt: null } });
    expect(changeLabel(added)).toEqual({ text: "민지 추가", tone: "friend" });
    const replaced = place("a-3", "강문해변 노을", {
      change: { origin: "REPLACED", by: { userId: 3, nickname: "서현" }, replacedFrom: { attractionId: 9, name: "경포호 산책" }, note: null, changedAt: null },
    });
    expect(changeLabel(replaced)).toEqual({ text: "서현 교체", tone: "friend" });
    expect(replacedLine(replaced)).toBe("경포호 산책 → 강문해변 노을");
    expect(replacedLine(added)).toBeNull();
    // 공유 화면처럼 사람이 숨겨진 경우
    expect(changeLabel({ change: { ...added.change, by: null } }).text).toBe("추가한 장소");
  });

  it("최근 변경 문장은 받침에 맞는 조사를 씁니다", () => {
    const base = { dayIndex: 0, note: null, at: "2026-10-16T10:00:00" };
    expect(
      latestChangeSentence({ ...base, type: "REPLACED", attractionName: "노을 감상", replacedFromName: "경포호 산책", by: { userId: 3, nickname: "서현" } }),
    ).toBe("서현이 경포호 산책을 노을 감상으로 바꿨어요.");
    expect(latestChangeSentence({ ...base, type: "ADDED", attractionName: "테라로사 커피공장", replacedFromName: null, by: { userId: 2, nickname: "민지" } })).toBe(
      "민지가 테라로사 커피공장을 추가했어요.",
    );
    expect(latestChangeSentence({ ...base, type: "REMOVED", attractionName: "오죽헌", replacedFromName: null, by: null })).toBe("친구가 오죽헌을 뺐어요.");
    expect(latestChangeSentence(null)).toBeNull();
  });

  it("변경 표시 요약과 접속 표시 문장", () => {
    expect(dayChangeSummary({ added: 1, replaced: 1, removed: 1 })).toBe("친구 변경 3건 · 추가 1 / 제외 1 / 교체 1");
    expect(dayChangeSummary({ added: 0, replaced: 0, removed: 0 })).toBeNull();
    expect(presenceSentence([])).toBeNull();
    expect(presenceSentence(["민지"])).toBe("민지가 보고 있어요");
    expect(presenceSentence(["서현"])).toBe("서현이 보고 있어요");
    expect(presenceSentence(["민지", "서현", "예소"])).toBe("민지 외 2명이 보고 있어요");
  });

  it("카드 설명은 승인된 한 줄 소개를 먼저 씁니다", () => {
    expect(itemDescription({ oneLine: "한 줄", personalReason: "나만", reason: "이유" })).toBe("한 줄");
    expect(itemDescription({ oneLine: null, personalReason: null, reason: "이유" })).toBe("이유");
    expect(itemDescription({ oneLine: null, personalReason: null, reason: null })).toBeNull();
  });

  it("여행 이름은 시군구 짧은 이름 + 여행", () => {
    expect(tripTitle("강원특별자치도 강릉시")).toBe("강릉 여행");
    expect(tripTitle("부산광역시 해운대구")).toBe("부산 해운대구 여행");
    expect(tripTitle(null)).toBe("새 여행");
  });
});

describe("드래그 순서 변경 (5-3 MOVE)", () => {
  const days = (): CourseDay[] => [
    { dayIndex: 0, date: "2027-01-15", items: [place("a-1", "A"), place("a-2", "B"), meal("m-3", "LUNCH"), place("a-4", "C")] },
    { dayIndex: 1, date: "2027-01-16", items: [place("a-5", "D")] },
  ];
  const names = (d: CourseDay[] | null, i: number) => d?.[i].items.map((x) => (x.type === "ATTRACTION" ? x.name : x.meal));

  it("식사는 같은 날 안에서만 옮깁니다", () => {
    expect(canMove(meal("m-3", "LUNCH"), 0, 0)).toBe(true);
    expect(canMove(meal("m-3", "LUNCH"), 0, 1)).toBe(false);
    expect(canMove(place("a-1", "A"), 0, 1)).toBe(true);
    expect(moveItem(days(), "m-3", { dayIndex: 1, position: 0 })).toBeNull();
  });

  it("position은 이 항목을 뺀 목록 기준입니다", () => {
    expect(names(moveItem(days(), "a-4", { dayIndex: 0, position: 0 }), 0)).toEqual(["C", "A", "B", "LUNCH"]);
    expect(names(moveItem(days(), "a-1", { dayIndex: 0, position: 3 }), 0)).toEqual(["B", "LUNCH", "C", "A"]);
    const cross = moveItem(days(), "a-2", { dayIndex: 1, position: 1 });
    expect(names(cross, 0)).toEqual(["A", "LUNCH", "C"]);
    expect(names(cross, 1)).toEqual(["D", "B"]);
  });

  it("손가락 위치로 놓을 자리를 셉니다", () => {
    // 카드 중심 100, 300, 500, 700 — 두 번째 카드(1)를 들고 있을 때
    expect(dropPosition([100, 300, 500, 700], 1, 50)).toBe(0);
    expect(dropPosition([100, 300, 500, 700], 1, 550)).toBe(2);
    expect(dropPosition([100, 300, 500, 700], 1, 900)).toBe(3);
  });

  it("낙관적 반영은 그날 첫 장소의 이동 시간을 지웁니다", () => {
    const course = { days: days() } as Course;
    const next = applyMove(course, "a-4", { dayIndex: 0, position: 0 });
    expect(names(next.days, 0)).toEqual(["C", "A", "B", "LUNCH"]);
    expect(next.days[0].items[0].travelFromPrevious).toBeNull();
    expect(applyMove(course, "m-3", { dayIndex: 1, position: 0 })).toBe(course);
  });
});
