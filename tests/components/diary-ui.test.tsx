import { fireEvent, render, screen } from "@testing-library/react-native";

import type { Diary, TravelMapPin } from "@/api/types";
import { DiaryBody } from "@/features/diary/components/DiaryBody";
import { TravelMapCanvas } from "@/features/diary/components/TravelMapCanvas";

// 여행기 화면 컴포넌트를 실제로 그려서 사용자가 보는 글자·접근성 라벨로 확인합니다 (React Native Testing Library).

const diary = (over: Partial<Diary> = {}): Diary => ({
  diaryId: 3,
  tripId: 20,
  status: "PUBLISHED",
  title: "성동의 골목과 빛이 건네는 이틀의 기록",
  body: "골목 끝 카페가 좋았어요.",
  courseTitle: "성동의 골목과 빛이 건네는 이틀의 기록",
  regionSigCd: "11200",
  visitedFrom: "2026-09-19",
  visitedTo: "2026-09-20",
  visibility: "FRIENDS",
  locationPrecision: "CITY",
  satisfaction: 4,
  experienceTags: ["골목", "카페"],
  coverPhotoId: null,
  photos: [],
  publishedAt: "2026-10-28T12:24:00",
  updatedAt: "2026-10-28T12:24:00",
  ...over,
});

const pin = (over: Partial<TravelMapPin> = {}): TravelMapPin => ({
  diaryId: 3,
  title: "성동 기록",
  courseTitle: null,
  coverPhotoUrl: null,
  visitedAt: "2026-09-19",
  regionSigCd: "11200",
  regionName: "서울특별시 성동구",
  lat: 37.56,
  lng: 127.04,
  locationPrecision: "CITY",
  visibility: "FRIENDS",
  status: "PUBLISHED",
  ...over,
});

describe("DiaryBody", () => {
  it("코스 제목이 여행기 제목과 같으면 날짜만 한 번 보여 준다", async () => {
    await render(<DiaryBody diary={diary()} />);
    expect(screen.getByRole("header", { name: "성동의 골목과 빛이 건네는 이틀의 기록" })).toBeOnTheScreen();
    expect(screen.queryAllByText(/성동의 골목과 빛이 건네는 이틀의 기록/)).toHaveLength(1);
    expect(screen.getByText(/9\.19/)).toBeOnTheScreen();
  });

  it("코스 제목이 다르면 날짜 앞에 함께 보여 준다", async () => {
    await render(<DiaryBody diary={diary({ title: "둘째 날이 더 좋았던 여행" })} />);
    expect(screen.getByText(/^성동의 골목과 빛이 건네는 이틀의 기록 · /)).toBeOnTheScreen();
  });

  it("만족도·경험 태그·본문을 보여 주고, 초안이면 나만 볼 수 있다고 알린다", async () => {
    await render(<DiaryBody diary={diary({ status: "DRAFT" })} />);
    expect(screen.getByLabelText("만족도 5점 중 4점")).toBeOnTheScreen();
    expect(screen.getByText("#골목")).toBeOnTheScreen();
    expect(screen.getByText("#카페")).toBeOnTheScreen();
    expect(screen.getByText("골목 끝 카페가 좋았어요.")).toBeOnTheScreen();
    expect(screen.getByText(/초안 · 아직 나만 볼 수 있어요/)).toBeOnTheScreen();
  });

  it("만족도와 태그가 없으면 그 줄을 그리지 않는다", async () => {
    await render(<DiaryBody diary={diary({ satisfaction: null, experienceTags: [] })} />);
    expect(screen.queryByLabelText(/만족도/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/^#/)).not.toBeOnTheScreen();
  });
});

describe("TravelMapCanvas", () => {
  const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 330, height: 400 } } };

  it("크기를 재기 전에는 핀을 그리지 않고, 잰 뒤에 핀마다 버튼을 그린다", async () => {
    await render(<TravelMapCanvas pins={[pin(), pin({ diaryId: 4, title: "제주 기록", regionName: "제주특별자치도 제주시", lat: 33.5, lng: 126.5 })]} onPinPress={jest.fn()} />);
    const map = screen.getByLabelText("나의 여행 지도, 기록 2곳");
    expect(screen.queryAllByRole("button")).toHaveLength(0);

    await fireEvent(map, "layout", layout);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "성동 기록, 서울특별시 성동구, 2026-09-19" })).toBeOnTheScreen();
  });

  it("핀을 누르면 그 여행기를 넘기고, 초안 핀에는 초안 표시가 붙는다", async () => {
    const onPinPress = jest.fn();
    await render(<TravelMapCanvas pins={[pin({ status: "DRAFT" })]} onPinPress={onPinPress} />);
    await fireEvent(screen.getByLabelText("나의 여행 지도, 기록 1곳"), "layout", layout);

    expect(screen.getByText("초안")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: /성동 기록/ }));
    expect(onPinPress).toHaveBeenCalledWith(expect.objectContaining({ diaryId: 3 }));
  });
});
