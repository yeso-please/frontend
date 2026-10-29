import { useLocalSearchParams } from "expo-router";

import { CourseScreen } from "@/features/course/screens/CourseScreen";

// 피그마 E0·E1·E2·E5~E8 함께 만드는 코스. 구현은 src/features/course 에 있습니다.
export default function TripCourseRoute() {
  // prep: 여행 준비 3/4(친구 초대)에서 넘어왔을 때만 붙습니다 ("solo" = 혼자 여행할게요)
  const { tripId, prep } = useLocalSearchParams<{ tripId: string; prep?: string }>();
  return <CourseScreen tripId={Number(tripId)} fromPrep={prep === "solo" || prep === "friends"} />;
}
