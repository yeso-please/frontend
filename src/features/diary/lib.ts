import type { Diary, DiaryUpdate, DiaryVisibility, LocationPrecision, TravelMapPin } from "@/api/types";
import { projectToMap } from "@/lib/mapProjection";

// 여행기 화면의 순수 계산 (테스트: tests/features/diary.test.ts)

export const PIN = 52;
export const POINTER = 8;
/** 가까운 핀은 이만큼 떨어뜨려 겹치지 않게 합니다 */
const MIN_GAP = 40;

export type Placed = { pin: TravelMapPin; left: number; top: number };

/** 지도 위 위치를 정하고, 너무 가까운 핀은 원을 그리며 조금씩 비켜 놓습니다. */
export function placePins(pins: TravelMapPin[], width: number, height: number): Placed[] {
  const placed: Placed[] = [];
  for (const pin of pins) {
    const p = projectToMap(pin.lat, pin.lng);
    let x = p.x * width;
    let y = p.y * height;
    for (let step = 0; step < 12 && placed.some((q) => Math.hypot(q.left + PIN / 2 - x, q.top + PIN + POINTER - y) < MIN_GAP); step += 1) {
      const angle = (step * Math.PI) / 3;
      const r = MIN_GAP * (1 + Math.floor(step / 6) * 0.6);
      x = p.x * width + Math.cos(angle) * r;
      y = p.y * height + Math.sin(angle) * r;
    }
    placed.push({ pin, left: x - PIN / 2, top: y - PIN - POINTER });
  }
  return placed;
}


export type Form = {
  title: string;
  body: string;
  satisfaction: number | null;
  experienceTags: string[];
  visibility: DiaryVisibility;
  locationPrecision: LocationPrecision;
  includeInTasteProfile: boolean;
};

export const formOf = (d: Diary): Form => ({
  title: d.title,
  body: d.body ?? "",
  satisfaction: d.satisfaction,
  experienceTags: d.experienceTags,
  visibility: d.visibility,
  locationPrecision: d.locationPrecision,
  includeInTasteProfile: d.includeInTasteProfile ?? true,
});

/** 바뀐 필드만 보냅니다 (6-4는 보낸 필드만 바꿈) */
export function diffForm(before: Form, after: Form): DiaryUpdate {
  const patch: DiaryUpdate = {};
  if (after.title.trim() !== before.title) patch.title = after.title.trim();
  if (after.body !== before.body) patch.body = after.body;
  if (after.satisfaction !== before.satisfaction) patch.satisfaction = after.satisfaction;
  if (after.experienceTags.join("|") !== before.experienceTags.join("|")) patch.experienceTags = after.experienceTags;
  if (after.visibility !== before.visibility) patch.visibility = after.visibility;
  if (after.locationPrecision !== before.locationPrecision) patch.locationPrecision = after.locationPrecision;
  if (after.includeInTasteProfile !== before.includeInTasteProfile) patch.includeInTasteProfile = after.includeInTasteProfile;
  return patch;
}

