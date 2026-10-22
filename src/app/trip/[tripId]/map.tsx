import { useLocalSearchParams } from "expo-router";

import { CourseMapScreen } from "@/features/place/CourseMapScreen";

// 코스 경로 지도 (5-7, 카카오맵 웹뷰). ?dayIndex= 로 처음 볼 날을 고릅니다. 구현은 src/features/place 에 있습니다.
export default function CourseMapRoute() {
  const { tripId, dayIndex } = useLocalSearchParams<{ tripId: string; dayIndex?: string }>();
  const initialDay = Number(dayIndex ?? 0);
  return <CourseMapScreen tripId={Number(tripId)} initialDay={Number.isFinite(initialDay) ? initialDay : 0} />;
}
