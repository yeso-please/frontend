import type { Diary, TravelMapPin } from "@/api/types";
import { diffForm, formOf, PIN, placePins, POINTER } from "@/features/diary/lib";

const pin = (diaryId: number, lat: number, lng: number): TravelMapPin => ({
  diaryId,
  title: `여행 ${diaryId}`,
  courseTitle: null,
  coverPhotoUrl: null,
  visitedAt: "2026-09-10",
  regionSigCd: null,
  regionName: null,
  lat,
  lng,
  locationPrecision: "CITY",
  visibility: "PRIVATE",
  status: "PUBLISHED",
});

describe("여행 지도 핀 배치", () => {
  it("핀 끝이 지역 좌표를 가리킵니다", () => {
    const [placed] = placePins([pin(1, 37.75, 128.9)], 300, 362);
    expect(placed.left + PIN / 2).toBeGreaterThan(0);
    expect(placed.top + PIN + POINTER).toBeGreaterThan(0);
  });

  it("같은 지역의 핀은 겹치지 않게 비켜 놓습니다", () => {
    const placed = placePins([pin(1, 37.75, 128.9), pin(2, 37.75, 128.9), pin(3, 37.75, 128.9)], 300, 362);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(Math.hypot(placed[i].left - placed[j].left, placed[i].top - placed[j].top)).toBeGreaterThanOrEqual(39);
      }
    }
  });
});

describe("여행기 수정 내용", () => {
  const diary = {
    diaryId: 1,
    tripId: 1,
    status: "DRAFT",
    title: "강릉 여행",
    body: null,
    courseTitle: null,
    regionSigCd: null,
    visitedFrom: "2026-09-10",
    visitedTo: "2026-09-11",
    visibility: "PRIVATE",
    locationPrecision: "CITY",
    satisfaction: null,
    experienceTags: [],
    includeInTasteProfile: true,
    coverPhotoId: null,
    photos: [],
    publishedAt: null,
    updatedAt: "2026-09-12T00:00:00",
  } satisfies Diary;

  it("바뀐 필드만 보내고 제목은 앞뒤 공백을 지웁니다", () => {
    const before = formOf(diary);
    expect(diffForm(before, before)).toEqual({});
    expect(diffForm(before, { ...before, title: "  바다 여행 ", satisfaction: 4, experienceTags: ["바다"] })).toEqual({
      title: "바다 여행",
      satisfaction: 4,
      experienceTags: ["바다"],
    });
  });

  it("본문이 없던 여행기는 빈 문자열로 시작해 그대로 두면 보내지 않습니다", () => {
    const before = formOf(diary);
    expect(before.body).toBe("");
    expect(diffForm(before, { ...before })).toEqual({});
  });
});
