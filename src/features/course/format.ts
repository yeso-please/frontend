import type { AttractionItem, CourseChanges, CourseFirstLeg, CourseItem, FirstLegMode, Transport, TravelLeg, UserRef } from "@/api/types";
import { shortRegionName, withEulReul, withEuro, withIGa } from "@/lib/josa";

// 코스 화면 문구·이동 시간 표시 규칙 (백엔드 frontend-guide "이동 시간 표시(D5)", "변경 기록 D11").
// 장소 편집(F1)·식사·지도 화면도 같은 규칙을 쓰도록 여기 모아 둡니다.

export const TRANSPORT_LABEL: Record<Transport, string> = { WALK: "도보", CAR: "자동차", PUBLIC_TRANSIT: "대중교통" };
export const TRANSPORT_ORDER: Transport[] = ["WALK", "CAR", "PUBLIC_TRANSIT"];

/** 5 → "5분", 75 → "1시간 15분", 120 → "2시간" */
export function formatMinutes(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`;
}

/** 650 → "650m", 1800 → "1.8km", 12345 → "12km" */
export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  const km = meters / 1000;
  return km >= 10 ? `${Math.round(km)}km` : `${km.toFixed(1).replace(/\.0$/, "")}km`;
}

/** 1,500 처럼 세 자리마다 쉼표 (Hermes Intl에 기대지 않음) */
const withComma = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * 5-8 지금 위치 → 첫 관광지 한 줄: "🚗 9분 3.1km · 🚶 38분 · 🚌 21분(환승 0, 1,500원)".
 * 직선 추정(STRAIGHT)은 "약 N분(직선 추정)", 도보가 null(10km 초과)이면 뺍니다.
 */
export function firstLegParts(leg: CourseFirstLeg): { mode: Transport; text: string }[] {
  const time = (m: FirstLegMode) => (m.source === "STRAIGHT" ? `약 ${formatMinutes(m.durationMinutes)}(직선 추정)` : formatMinutes(m.durationMinutes));
  const parts: { mode: Transport; text: string }[] = [{ mode: "CAR", text: `🚗 ${time(leg.car)} ${formatDistance(leg.car.distanceMeters)}` }];
  if (leg.walk) parts.push({ mode: "WALK", text: `🚶 ${time(leg.walk)}` });
  const t = leg.transit;
  const extra = [t.transfers != null ? `환승 ${t.transfers}` : null, t.fare != null ? `${withComma(t.fare)}원` : null].filter(Boolean).join(", ");
  parts.push({ mode: "PUBLIC_TRANSIT", text: `🚌 ${time(t)}${t.source === "TRANSIT" && extra ? `(${extra})` : ""}` });
  return parts;
}

export type TravelModeTime = {
  mode: Transport;
  label: string;
  minutes: number;
  /** 직선 추정이면 true → "약"을 붙입니다 */
  approx: boolean;
  /** "약 12분" / "6분" */
  text: string;
};

const SOURCE_KEY: Record<Transport, { minutes: keyof TravelLeg; source: keyof TravelLeg }> = {
  WALK: { minutes: "walkMinutes", source: "walkSource" },
  CAR: { minutes: "carMinutes", source: "carSource" },
  PUBLIC_TRANSIT: { minutes: "transitMinutes", source: "transitSource" },
};

/** 앞 지점에서 세 수단 이동 시간. 그날 첫 지점·식당 미정 식사(leg null)는 빈 배열 */
export function travelModes(leg: TravelLeg | null | undefined): TravelModeTime[] {
  if (!leg) return [];
  return TRANSPORT_ORDER.map((mode) => {
    const minutes = leg[SOURCE_KEY[mode].minutes] as number;
    const approx = leg[SOURCE_KEY[mode].source] === "STRAIGHT";
    return { mode, label: TRANSPORT_LABEL[mode], minutes, approx, text: `${approx ? "약 " : ""}${formatMinutes(minutes)}` };
  });
}

/** 카드 한 줄 요약: "자동차 약 6분 · 1.8km" (기본 강조 수단 = 여행 이동수단) */
export function travelSummary(leg: TravelLeg | null | undefined, transport: Transport) {
  const mode = travelModes(leg).find((m) => m.mode === transport);
  if (!leg || !mode) return null;
  return `${mode.label} ${mode.text} · ${formatDistance(leg.meters)}`;
}

/** 대중교통 실제 경로일 때 "환승 1회 · 1,500원" */
export function transitDetail(leg: TravelLeg | null | undefined) {
  if (!leg || leg.transitSource === "STRAIGHT") return null;
  const parts: string[] = [];
  if (leg.transitTransfers != null) parts.push(leg.transitTransfers === 0 ? "환승 없음" : `환승 ${leg.transitTransfers}회`);
  if (leg.transitFare != null) parts.push(`${leg.transitFare.toLocaleString("ko-KR")}원`);
  return parts.length ? parts.join(" · ") : null;
}

export type ChangeTone = "base" | "friend";
export type ChangeLabel = { text: string; tone: ChangeTone };

const nick = (by: UserRef | null | undefined) => by?.nickname ?? null;

/** 카드 라벨: BASE "기본 추천", ADDED "{닉네임} 추가", REPLACED "{닉네임} 교체" */
export function changeLabel(item: Pick<AttractionItem, "change">): ChangeLabel {
  const { origin, by } = item.change;
  if (origin === "ADDED") return { text: nick(by) ? `${nick(by)} 추가` : "추가한 장소", tone: "friend" };
  if (origin === "REPLACED") return { text: nick(by) ? `${nick(by)} 교체` : "교체한 장소", tone: "friend" };
  return { text: "기본 추천", tone: "base" };
}

/** 교체 카드 보조 줄: "경포호 산책 → 강문해변 노을" */
export function replacedLine(item: Pick<AttractionItem, "change" | "name">) {
  const from = item.change.replacedFrom?.name;
  return item.change.origin === "REPLACED" && from ? `${from} → ${item.name}` : null;
}

/** 카드 설명 한 줄: 승인된 한 줄 소개 → 본인 전용 AI 이유 → 추천 이유 */
export function itemDescription(item: Pick<AttractionItem, "oneLine" | "personalReason" | "reason">) {
  return item.oneLine ?? item.personalReason ?? item.reason ?? null;
}

export const mealLabel = (meal: "LUNCH" | "DINNER") => (meal === "LUNCH" ? "점심" : "저녁");

/** "민지가 경포호 산책을 노을 감상으로 바꿨어요" (changes.latest) */
export function latestChangeSentence(latest: CourseChanges["latest"]) {
  if (!latest) return null;
  const who = withIGa(latest.by?.nickname ?? "친구");
  const place = latest.attractionName;
  switch (latest.type) {
    case "REPLACED":
      return latest.replacedFromName
        ? `${who} ${withEulReul(latest.replacedFromName)} ${withEuro(place)} 바꿨어요.`
        : `${who} ${withEuro(place)} 바꿨어요.`;
    case "ADDED":
      return `${who} ${withEulReul(place)} 추가했어요.`;
    case "REMOVED":
      return `${who} ${withEulReul(place)} 뺐어요.`;
    case "RESTORED":
      return `${who} ${withEulReul(place)} 다시 넣었어요.`;
  }
}

/** 변경 표시 탭의 일자 요약: "친구 변경 3건 · 추가 1 / 제외 1 / 교체 1". 변경이 없으면 null */
export function dayChangeSummary(day: { added: number; replaced: number; removed: number } | undefined) {
  if (!day) return null;
  const total = day.added + day.replaced + day.removed;
  if (total === 0) return null;
  return `친구 변경 ${total}건 · 추가 ${day.added} / 제외 ${day.removed} / 교체 ${day.replaced}`;
}

/** "민지가 보고 있어요" / "민지 외 2명이 보고 있어요". 아무도 없으면 null */
export function presenceSentence(nicknames: string[]) {
  if (nicknames.length === 0) return null;
  if (nicknames.length === 1) return `${withIGa(nicknames[0])} 보고 있어요`;
  return `${nicknames[0]} 외 ${nicknames.length - 1}명이 보고 있어요`;
}

/** "강원특별자치도 강릉시" → "강릉 여행". 지역 전이면 대체 제목을 씁니다 */
export function tripTitle(regionName: string | null | undefined, fallback = "새 여행") {
  if (!regionName) return fallback;
  const [province, ...rest] = regionName.trim().split(/\s+/);
  const city = rest.join(" ");
  return `${city ? shortRegionName(province, city) : province} 여행`;
}

/** 이름 첫 글자 아바타 */
export const initial = (nickname: string) => nickname.trim().slice(0, 1) || "?";

export const isAttraction = (item: CourseItem): item is AttractionItem => item.type === "ATTRACTION";
