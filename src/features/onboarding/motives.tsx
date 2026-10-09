import type { ReactNode } from "react";

import type { ScheduleDensity, TravelMotive } from "@/api/types";
import { Icons } from "@/components/icons";

// 서버 travelMotives 코드 → 피그마 온보딩(401:1071) 아이콘·설명. 제목은 항상 서버 label을 씁니다.
// 피그마에 없는 코드(4 나를 돌아보기, 5 SNS에 올릴 사진, 9 특별한 날 기념)는 기본 아이콘만 두고 설명은 비웁니다.
const MOTIVE_META: Record<number, { icon: () => ReactNode; subtitle: string }> = {
  2: { icon: () => <Icons.MotiveRest width={25} height={25} />, subtitle: "자연 속 힐링과 온전한 쉼을 위한 시간" },
  7: { icon: () => <Icons.MotiveNewExperience width={25} height={25} />, subtitle: "낯선 장소에서 느끼는 뜻밖의 두근거림" },
  1: { icon: () => <Icons.MotiveEscape width={25} height={25} />, subtitle: "반복되는 하루에서 벗어난 자유로운 모험" },
  3: { icon: () => <Icons.MotiveCompanion width={26} height={15} />, subtitle: "소중한 사람과 함께 나누는 특별한 추억" },
  8: { icon: () => <Icons.MotiveHistory width={22} height={22} />, subtitle: "로컬의 깊은 이야기와 문화유산 탐방" },
  6: { icon: () => <Icons.MotiveWellness width={22} height={22} />, subtitle: "몸과 마음에 활력을 채우는 활동" },
};

/** 피그마 카드 순서(휴식 → 새로운 경험 → 일상 탈출 → 동반자 → 역사 → 건강)를 먼저, 나머지는 서버 순서대로 */
const FIGMA_ORDER = [2, 7, 1, 3, 8, 6];

export function sortMotives(motives: TravelMotive[]) {
  const rank = (code: number) => {
    const i = FIGMA_ORDER.indexOf(code);
    return i === -1 ? FIGMA_ORDER.length + code : i;
  };
  return [...motives].sort((a, b) => rank(a.code) - rank(b.code));
}

export function motiveIcon(code: number): ReactNode {
  return MOTIVE_META[code]?.icon() ?? <Icons.Spark width={22} height={22} />;
}

export function motiveSubtitle(code: number): string | undefined {
  return MOTIVE_META[code]?.subtitle;
}

/** 일정 밀도 문구 (백엔드: RELAXED 하루 목표 4곳, PACKED 6곳) */
export const DENSITY_COPY: Record<ScheduleDensity, { title: string; subtitle: string; perDay: number; short: string }> = {
  RELAXED: { title: "여유롭게 둘러볼래요", subtitle: "하루 최대 4곳", perDay: 4, short: "여유롭게" },
  PACKED: { title: "가능한 많이 둘러볼래요", subtitle: "하루 최대 6곳", perDay: 6, short: "알차게" },
};
