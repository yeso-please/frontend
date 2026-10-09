import { Tabs } from "expo-router/js-tabs";

import { TabBar } from "@/components/navigation/TabBar";

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: "shift" }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="trips" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="my" />
    </Tabs>
  );
}
