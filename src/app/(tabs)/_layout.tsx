import { Tabs } from "expo-router/js-tabs";

import { TabBar } from "@/components/navigation/TabBar";

// 홈 / 여행 / 저장 / MY. 저장 탭 = 내 코스(피그마 추가 화면 01, 2026-10-29 수정본).
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: "shift", freezeOnBlur: true }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="travel" />
      <Tabs.Screen name="courses" />
      <Tabs.Screen name="my" />
    </Tabs>
  );
}
