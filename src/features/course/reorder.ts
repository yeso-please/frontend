import type { Course, CourseDay, CourseItem } from "@/api/types";

// 드래그 순서 변경(E5~E8, 5-3 MOVE)의 순수 계산. 화면은 이 결과로 먼저 그리고(낙관적 반영) 서버 응답으로 덮어씁니다.

export type DropTarget = { dayIndex: number; position: number };

/** 식사는 같은 날 안에서만 옮길 수 있습니다 (날마다 점심·저녁은 하나씩) */
export function canMove(item: CourseItem, fromDay: number, toDay: number) {
  return item.type === "ATTRACTION" || fromDay === toDay;
}

/**
 * 드래그 중 손가락 위치(콘텐츠 기준 y)로 놓을 자리(0부터, 끌고 있는 카드를 뺀 목록 기준)를 정합니다.
 * centers는 그날 카드들의 세로 중심(끌고 있는 카드 포함, 원래 순서).
 */
export function dropPosition(centers: number[], fromIndex: number, y: number) {
  let position = 0;
  centers.forEach((center, index) => {
    if (index !== fromIndex && y > center) position += 1;
  });
  return position;
}

/** 옮긴 뒤 결과가 원래와 같은지 (같은 날, 같은 자리) */
export function isSamePlace(fromDay: number, fromIndex: number, target: DropTarget) {
  return target.dayIndex === fromDay && target.position === fromIndex;
}

/** itemId를 target 날의 position(그 날 목록에서 이 항목을 뺀 뒤의 위치)으로 옮긴 새 days. 못 옮기면 null */
export function moveItem(days: CourseDay[], itemId: string, target: DropTarget): CourseDay[] | null {
  const fromDay = days.find((d) => d.items.some((i) => i.itemId === itemId));
  const toDay = days.find((d) => d.dayIndex === target.dayIndex);
  if (!fromDay || !toDay) return null;
  const item = fromDay.items.find((i) => i.itemId === itemId)!;
  if (!canMove(item, fromDay.dayIndex, toDay.dayIndex)) return null;

  const next = days.map((d) => ({ ...d, items: d.items.filter((i) => i.itemId !== itemId) }));
  const dest = next.find((d) => d.dayIndex === target.dayIndex)!;
  const position = Math.max(0, Math.min(target.position, dest.items.length));
  dest.items = [...dest.items.slice(0, position), item, ...dest.items.slice(position)];
  return next;
}

/** 낙관적 반영용: 코스 전체에 moveItem을 적용합니다. 옮긴 날들의 이동 시간은 서버가 다시 계산하므로 지웁니다 */
export function applyMove(course: Course, itemId: string, target: DropTarget): Course {
  const days = moveItem(course.days, itemId, target);
  if (!days) return course;
  const touched = new Set([target.dayIndex, course.days.find((d) => d.items.some((i) => i.itemId === itemId))?.dayIndex]);
  return {
    ...course,
    days: days.map((d) =>
      touched.has(d.dayIndex)
        ? {
            ...d,
            items: d.items.map((i, index) =>
              index === 0 ? { ...i, travelFromPrevious: null, travelFromPreviousMinutes: null, travelFromPreviousMeters: null } : i,
            ),
          }
        : d,
    ),
  };
}
