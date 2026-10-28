import { useLocalSearchParams } from "expo-router";

import { AddPlaceScreen } from "@/features/place/AddPlaceScreen";

// 장소 추가 — 지도 관광지 핀(7-3)·추천 장소(5-4)에서 골라 그 날 코스에 넣습니다(5-3 ADD). 구현은 src/features/place 에 있습니다.
export default function AddPlaceRoute() {
  const { tripId, dayIndex } = useLocalSearchParams<{ tripId: string; dayIndex?: string }>();
  return <AddPlaceScreen tripId={Number(tripId)} dayIndex={Number(dayIndex ?? 0)} />;
}
