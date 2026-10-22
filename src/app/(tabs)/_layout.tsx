import { Tabs } from "expo-router/js-tabs";

import { TabBar } from "@/components/navigation/TabBar";

// 홈 / 여행 / MY. 피그마의 "저장" 탭은 이번 범위에서 뺍니다 (백엔드 product.md D14).
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: "shift", freezeOnBlur: true }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="travel" />
      <Tabs.Screen name="my" />
    </Tabs>
  );
}
