import { useLocalSearchParams } from "expo-router";

import { InviteCourseScreen } from "@/features/course/screens/InviteCourseScreen";

// 피그마 E4 여행 둘러보기 (로그인 없이 열립니다)
export default function InviteCourseRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <InviteCourseScreen token={token} />;
}
