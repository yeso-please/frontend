import { useLocalSearchParams } from "expo-router";

import { ParticipantsScreen } from "@/features/course/screens/ParticipantsScreen";

// 피그마 E3 참여자 관리
export default function ParticipantsRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <ParticipantsScreen tripId={Number(tripId)} />;
}
