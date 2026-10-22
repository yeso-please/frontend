import type { ImageSourcePropType } from "react-native";

import personas from "./travel-personas.json";
import { MBTI_TYPES, type MbtiType } from "./types";

// 여행 성향 16유형 콘텐츠는 프론트 상수입니다 (D4). 백엔드 src/main/resources/personas/travel-personas.json을
// 그대로 복사한 것이니, 문구를 바꿀 때는 백엔드 파일과 함께 바꿉니다 (백엔드는 지역 맞춤 문장의 성향 이름에만 씁니다).
// 팀 검수 전 초안(status DRAFT)입니다.

export type MbtiProfile = {
  code: MbtiType;
  /** 성향 이름 (예: 낭만적인 기록가) */
  name: string;
  /** 한 줄 요약 */
  oneLiner: string;
  description: string;
  /** "#" 없이 4개 */
  hashtags: string[];
  /** "나의 여행 취향 한눈에" */
  pace: string;
  places: string[];
  activities: string[];
  companions: string[];
};

type PersonaJson = Omit<MbtiProfile, "code"> & { code: string; characterKey: string };

const byCode = new Map((personas.types as PersonaJson[]).map((p) => [p.code, p]));

export const MBTI_PROFILES = Object.fromEntries(
  MBTI_TYPES.map((code) => {
    const p = byCode.get(code);
    if (!p) throw new Error(`travel-personas.json에 ${code}가 없습니다`);
    const profile: MbtiProfile = {
      code,
      name: p.name,
      oneLiner: p.oneLiner,
      description: p.description,
      hashtags: p.hashtags,
      pace: p.pace,
      places: p.places,
      activities: p.activities,
      companions: p.companions,
    };
    return [code, profile];
  }),
) as Record<MbtiType, MbtiProfile>;

/** 목록 값을 "골목 · 서점 · 카페"처럼 잇습니다 */
export const joinDot = (values: string[]) => values.join(" · ");

// 캐릭터: 백엔드 초안은 디자이너 제작 전까지 모두 INFP 임시 캐릭터(Q5)지만, 앱에는 피그마에서 받은 16유형 캐릭터가 있어 그것을 씁니다.
// Metro는 정적 require만 번들에 넣으므로 16개를 모두 나열합니다.
export const MBTI_IMAGES: Record<MbtiType, ImageSourcePropType> = {
  ISTJ: require("@/assets/illustrations/characters/istj.webp"),
  ISFJ: require("@/assets/illustrations/characters/isfj.webp"),
  INFJ: require("@/assets/illustrations/characters/infj.webp"),
  INTJ: require("@/assets/illustrations/characters/intj.webp"),
  ISTP: require("@/assets/illustrations/characters/istp.webp"),
  ISFP: require("@/assets/illustrations/characters/isfp.webp"),
  INFP: require("@/assets/illustrations/characters/infp.webp"),
  INTP: require("@/assets/illustrations/characters/intp.webp"),
  ESTJ: require("@/assets/illustrations/characters/estj.webp"),
  ESFJ: require("@/assets/illustrations/characters/esfj.webp"),
  ENFJ: require("@/assets/illustrations/characters/enfj.webp"),
  ENTJ: require("@/assets/illustrations/characters/entj.webp"),
  ESTP: require("@/assets/illustrations/characters/estp.webp"),
  ESFP: require("@/assets/illustrations/characters/esfp.webp"),
  ENFP: require("@/assets/illustrations/characters/enfp.webp"),
  ENTP: require("@/assets/illustrations/characters/entp.webp"),
};
