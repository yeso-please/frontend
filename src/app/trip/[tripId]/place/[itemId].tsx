import { useLocalSearchParams } from "expo-router";

import { PlaceEditScreen } from "@/features/place/PlaceEditScreen";

// 피그마 초안 F1 · 장소 편집 (지도와 대체 추천). 구현은 src/features/place 에 있습니다.
export default function PlaceEditRoute() {
  const { tripId, itemId } = useLocalSearchParams<{ tripId: string; itemId: string }>();
  return <PlaceEditScreen tripId={Number(tripId)} itemId={String(itemId)} />;
}
