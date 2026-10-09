import { useSyncExternalStore } from "react";

import { useMbtiStore } from "@/store/mbti";

const subscribe = (onChange: () => void) => useMbtiStore.persist.onFinishHydration(onChange);
const getSnapshot = () => useMbtiStore.persist.hasHydrated();

/** AsyncStorage에서 MBTI 결과를 다 읽어 왔는지. 읽기 전에 "결과 없음"을 잠깐 보여 주지 않으려고 씁니다. */
export function useMbtiHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
