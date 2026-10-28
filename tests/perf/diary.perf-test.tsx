import { fireEvent, screen } from "@testing-library/react-native";
import { measureRenders } from "reassure";

import type { Diary, TravelMapPin } from "@/api/types";
import { DiaryBody } from "@/features/diary/components/DiaryBody";
import { TravelMapCanvas } from "@/features/diary/components/TravelMapCanvas";

// Reassure 렌더 성능 측정 — `npx reassure --baseline`로 기준을 남기고, 바꾼 뒤 `npx reassure`로 비교합니다.
// 결과는 .reassure/ 에 쌓입니다 (git에 올리지 않음).

const pins: TravelMapPin[] = Array.from({ length: 30 }, (_, i) => ({
  diaryId: i + 1,
  title: `여행기 ${i + 1}`,
  courseTitle: null,
  coverPhotoUrl: `https://example.com/thumb-${i}.jpg`,
  visitedAt: "2026-09-19",
  regionSigCd: "11200",
  regionName: "서울특별시 성동구",
  // 같은 곳에 몰린 핀은 placePins가 나선형으로 떼어 놓습니다 — 겹침 계산이 가장 무거운 경우
  lat: 37.5 + (i % 5) * 0.01,
  lng: 127.0 + (i % 3) * 0.01,
  locationPrecision: "CITY",
  visibility: "FRIENDS",
  status: i % 4 === 0 ? "DRAFT" : "PUBLISHED",
}));

const diary: Diary = {
  diaryId: 1,
  tripId: 1,
  status: "PUBLISHED",
  title: "성동의 골목과 빛이 건네는 이틀의 기록",
  body: "골목 끝 카페가 좋았어요. ".repeat(80),
  courseTitle: "성동 코스",
  regionSigCd: "11200",
  visitedFrom: "2026-09-19",
  visitedTo: "2026-09-20",
  visibility: "FRIENDS",
  locationPrecision: "CITY",
  satisfaction: 4,
  experienceTags: ["골목", "카페", "로컬 음식", "산책", "시장"],
  coverPhotoId: 1,
  photos: Array.from({ length: 30 }, (_, i) => ({
    photoId: i + 1,
    url: `https://example.com/photo-${i}.jpg`,
    thumbnailUrl: `https://example.com/thumb-${i}.jpg`,
    takenAt: null,
    lat: null,
    lng: null,
    order: i,
  })),
  publishedAt: "2026-10-28T12:00:00",
  updatedAt: "2026-10-28T12:00:00",
};

test("나의 여행 지도 — 핀 30개를 크기 측정 뒤 배치", async () => {
  await measureRenders(<TravelMapCanvas pins={pins} onPinPress={() => {}} />, {
    scenario: async () => {
      await fireEvent(screen.getByLabelText(/나의 여행 지도/), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 330, height: 400 } } });
    },
  });
});

test("여행기 본문 — 사진 30장·긴 본문", async () => {
  await measureRenders(<DiaryBody diary={diary} />);
});
