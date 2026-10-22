import { useLocalSearchParams } from "expo-router";

import { MealScreen } from "@/features/place/MealScreen";

// 식사 카드(D6) — 식당 고르기 (5-5 추천·5-6 카카오 검색 → 5-3 SET_RESTAURANT). 구현은 src/features/place 에 있습니다.
export default function MealRoute() {
  const { tripId, itemId } = useLocalSearchParams<{ tripId: string; itemId: string }>();
  return <MealScreen tripId={Number(tripId)} itemId={String(itemId)} />;
}
