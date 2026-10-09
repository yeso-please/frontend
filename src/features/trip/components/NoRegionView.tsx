import { router } from "expo-router";

import { EmptyView } from "@/components/ui";

/** 핀 먼저 흐름: 홈에서 지역을 뽑지 않고 들어오면 준비를 시작할 수 없습니다. */
export function NoRegionView() {
  return (
    <EmptyView
      title="홈에서 핀을 먼저 꽂아 주세요"
      description={"여행지를 정하면 날짜와 함께 갈 친구를\n차근차근 준비할 수 있어요."}
      actionLabel="홈으로 가기"
      onAction={() => router.navigate("/")}
    />
  );
}
