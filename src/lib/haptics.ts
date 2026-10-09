import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// 기기에 따라 햅틱이 없을 수 있으니 실패는 조용히 무시합니다.
const run = (fn: () => Promise<void>) => {
  fn().catch(() => undefined);
};

const android = (type: Haptics.AndroidHaptics) => run(() => Haptics.performAndroidHapticsAsync(type));

export const haptics = {
  /** 버튼·카드 눌림 */
  tap: () => (Platform.OS === "android" ? android(Haptics.AndroidHaptics.Virtual_Key) : run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))),
  /** 칩·답변 선택, 슬라이더 칸 이동 */
  tick: () => (Platform.OS === "android" ? android(Haptics.AndroidHaptics.Segment_Tick) : run(() => Haptics.selectionAsync())),
  /** 완료·성공 */
  confirm: () => (Platform.OS === "android" ? android(Haptics.AndroidHaptics.Confirm) : run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))),
  /** 제한 초과·거절 */
  reject: () => (Platform.OS === "android" ? android(Haptics.AndroidHaptics.Reject) : run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))),
  /** 핀 착지처럼 묵직한 순간 */
  thud: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
};
