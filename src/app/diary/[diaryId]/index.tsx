import { useLocalSearchParams } from "expo-router";

import { DiaryScreen } from "@/features/diary/screens/DiaryScreen";

// 여행기 보기 (6-6)
export default function DiaryRoute() {
  const { diaryId } = useLocalSearchParams<{ diaryId: string }>();
  return <DiaryScreen diaryId={Number(diaryId)} />;
}
