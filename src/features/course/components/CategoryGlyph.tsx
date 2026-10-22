import Svg, { Path } from "react-native-svg";

import type { AttractionCategory } from "@/api/types";
import { colors } from "@/theme";

export const CATEGORY_LABEL: Record<AttractionCategory, string> = {
  NATURE: "자연",
  HISTORY_CULTURE: "역사·문화",
  ACTIVITY: "체험·레포츠",
  WALK_REST: "산책·휴식",
  ETC: "기타",
};

type Kind = AttractionCategory | "MEAL";

// 피그마 코스 카드의 파란 선 아이콘(물결·컵·나무)을 유형별로 그립니다. 사진이 없을 때 썸네일 자리에 씁니다.
const PATHS: Record<Kind, string> = {
  // 나무
  NATURE: "M12 3 6 11h3l-4 6h6v4h2v-4h6l-4-6h3z",
  // 기와 지붕·기둥
  HISTORY_CULTURE: "M3 9 12 4l9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18",
  // 깃발
  ACTIVITY: "M6 21V4M6 4h11l-2.5 4L17 12H6",
  // 물결
  WALK_REST: "M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0",
  // 핀
  ETC: "M12 21s-6-6.2-6-11a6 6 0 1 1 12 0c0 4.8-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  // 컵
  MEAL: "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11 3v3M14 3v3",
};

export function CategoryGlyph({ kind, size = 22, color = colors.blue }: { kind: Kind; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={PATHS[kind]} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
