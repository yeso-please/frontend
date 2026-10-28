import { useLocalSearchParams } from "expo-router";

import { SharedDiaryScreen } from "@/features/diary/screens/DiaryScreen";

// 여행기 공유 링크 (tripin://diary-link/{token}) — 로그인 없이 열립니다 (6-11·6-12)
export default function SharedDiaryRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <SharedDiaryScreen token={token} />;
}
