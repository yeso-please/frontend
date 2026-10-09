import { router } from "expo-router";

import { EmptyView, Screen } from "@/components/ui";

// "저장" 탭 — 디자이너 메모(415:762): 내가 저장한 코스 목록 + 상태(짜는중·완성·다녀옴). 화면 디자인이 나오면 구현합니다.
export default function SavedTab() {
  return (
    <Screen>
      <EmptyView
        title="저장한 코스가 여기에 모여요"
        description="코스를 짜는 중인 여행, 완성한 여행, 다녀온 여행을 한눈에 볼 수 있도록 준비하고 있어요."
        actionLabel="핀 꽂으러 가기"
        onAction={() => router.navigate("/")}
      />
    </Screen>
  );
}
