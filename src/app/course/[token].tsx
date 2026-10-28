import { useLocalSearchParams } from "expo-router";

import { SharedCourseScreen } from "@/features/course/screens/SharedCourseScreen";

// 코스 공유 링크 (tripin://course/{token}) — 로그인 없이 읽기 전용으로 열립니다 (4-12·4-13)
export default function SharedCourseRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <SharedCourseScreen token={token} />;
}
