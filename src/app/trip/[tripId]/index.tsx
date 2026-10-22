import { useLocalSearchParams } from "expo-router";

import { CourseScreen } from "@/features/course/screens/CourseScreen";

// 피그마 E0·E1·E2·E5~E8 함께 만드는 코스. 구현은 src/features/course 에 있습니다.
export default function TripCourseRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <CourseScreen tripId={Number(tripId)} />;
}
