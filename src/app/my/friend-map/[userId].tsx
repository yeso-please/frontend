import { useLocalSearchParams } from "expo-router";

import { FriendTravelMapScreen } from "@/features/diary/screens/TravelMapScreen";

// 친구 여행 지도 (6-8). params: userId, nickname
export default function FriendTravelMapRoute() {
  const { userId, nickname } = useLocalSearchParams<{ userId: string; nickname?: string }>();
  return <FriendTravelMapScreen userId={Number(userId)} nickname={nickname ?? "친구"} />;
}
