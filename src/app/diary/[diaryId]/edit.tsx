import { useLocalSearchParams } from "expo-router";

import { DiaryEditScreen } from "@/features/diary/screens/DiaryEditScreen";

// 여행기 쓰기·수정 (6-2~6-5)
export default function DiaryEditRoute() {
  const { diaryId } = useLocalSearchParams<{ diaryId: string }>();
  return <DiaryEditScreen diaryId={Number(diaryId)} />;
}
