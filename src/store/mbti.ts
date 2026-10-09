import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// 여행 MBTI 검사 결과. 앱 안에서만 계산·보관하고 서버에는 보내지 않습니다
// (구형 demo-mbti-v1으로 제출하면 최신 온보딩 취향을 덮어쓰기 때문).
export type MbtiType =
  | "ISTJ" | "ISFJ" | "INFJ" | "INTJ"
  | "ISTP" | "ISFP" | "INFP" | "INTP"
  | "ESTP" | "ESFP" | "ENFP" | "ENTP"
  | "ESTJ" | "ESFJ" | "ENFJ" | "ENTJ";

export type MbtiResult = {
  type: MbtiType;
  /** S2에서 고른 좋아하는 경험 태그 (결과 화면 "선호 장소" 등에 사용) */
  preferenceTags: string[];
  /** S2에서 고른 피하고 싶은 조건 */
  exclusionTags: string[];
  completedAt: string;
};

type MbtiState = {
  result: MbtiResult | null;
  setResult: (result: MbtiResult) => void;
  clear: () => void;
};

export const useMbtiStore = create<MbtiState>()(
  persist(
    (set) => ({
      result: null,
      setResult: (result) => set({ result }),
      clear: () => set({ result: null }),
    }),
    { name: "tripin.mbti.v1", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
