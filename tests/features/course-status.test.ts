import { countByStatus, courseStatusOf, sortForCourses } from "@/features/trip/courseStatus";

// 내 코스 탭(추가 화면 01): 다가오는 여행은 코스 유무로 짜는 중/완성, 끝난 여행은 다녀옴.
const TODAY = "2026-10-28";
const trip = (id: number, startDate: string, endDate: string, hasCourse: boolean) => ({ tripId: id, startDate, endDate, hasCourse });

describe("courseStatusOf", () => {
  it("종료일이 오늘보다 앞이면 다녀옴, 오늘 끝나는 여행은 아직 다가오는 여행이다 (3-6 기준)", () => {
    expect(courseStatusOf(trip(1, "2026-10-20", "2026-10-27", true), TODAY)).toBe("PAST");
    expect(courseStatusOf(trip(2, "2026-10-26", "2026-10-28", true), TODAY)).toBe("DONE");
  });

  it("다가오는 여행은 코스가 있으면 완성, 없으면 짜는 중", () => {
    expect(courseStatusOf(trip(3, "2026-11-20", "2026-11-21", true), TODAY)).toBe("DONE");
    expect(courseStatusOf(trip(4, "2026-11-20", "2026-11-21", false), TODAY)).toBe("PLANNING");
    expect(courseStatusOf(trip(5, "2026-09-01", "2026-09-02", false), TODAY)).toBe("PAST");
  });
});

describe("countByStatus · sortForCourses", () => {
  const trips = [
    trip(1, "2026-09-19", "2026-09-20", true),
    trip(2, "2026-12-01", "2026-12-02", false),
    trip(3, "2026-11-20", "2026-11-21", true),
    trip(4, "2026-10-01", "2026-10-03", true),
  ];

  it("탭 숫자를 센다", () => {
    expect(countByStatus(trips, TODAY)).toEqual({ ALL: 4, PLANNING: 1, DONE: 1, PAST: 2 });
  });

  it("다가오는 여행은 가까운 날짜부터, 다녀온 여행은 최근부터 그 뒤에", () => {
    expect(sortForCourses(trips, TODAY).map((t) => t.tripId)).toEqual([3, 2, 4, 1]);
  });
});
