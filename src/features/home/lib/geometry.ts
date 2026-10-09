import { Extrapolation, interpolate } from "react-native-reanimated";

import { screenPadding } from "@/theme";

// 피그마 01·02·03 (390×844 프레임) 실측값. 기기 크기에 맞춰 비율로 늘이고 줄입니다.
const FIGMA = {
  width: 390,
  /** 상태바 아래 → 앱바 (y56 - 상태바 50) */
  appBarGap: 6,
  appBarHeight: 44,
  /** 앱바 아래 → 인트로 (y118 - 100) */
  introGap: 18,
  /** 01·02 인트로(헤드라인 2줄 + 본문) 높이 */
  introHeight: 112,
  /** 01 큰 지도 이미지 상자 328×410, 화면 중심보다 7 왼쪽 */
  bigMapWidth: 328,
  bigMapHeight: 410,
  bigMapOffsetX: -7,
  /** 02~04 작은 지도 260×325 → 큰 지도 대비 배율 */
  smallScale: 260 / 328,
  /** 인트로 시작(118) → 작은 지도 위쪽(217) */
  smallTopFromIntro: 99,
  /** 큰 지도 중심 x(188) → 작은 지도 중심 x(165) */
  smallOffsetX: -23,
  /** 하단 버튼 영역: 46 + 4 + 44, 탭바 위 20 */
  actionsHeight: 94,
  actionsBottomGap: 20,
} as const;

/** 지도 이미지 비율 (korea-map.webp 984×1230) */
const MAP_ASPECT = 984 / 1230;

// 바텀시트 (피그마 Destination sheet Compact h288 / Expanded h444)
export const SHEET = {
  compact: 288,
  /** 손잡이 영역: 위 여백 8 + 손잡이 16 */
  handle: 24,
  /** 시트 하단에 고정되는 버튼·안내 영역 높이 (위 8 + 버튼 46 + 8 + 캡션 18 + 아래 24) */
  footer: 104,
  /** 펼친 상태 최소 높이 = 접힌 높이 + 이 값 */
  minExpandedExtra: 56,
  /** 시트를 펼치면 지도가 살짝 작아집니다 */
  expandedMapScale: 0.96,
  /** 시트를 펼치면 지도를 이만큼 흐리게 */
  expandedMapOpacity: 0.55,
} as const;

// 핀(44×42 아이콘) 끝점 기준 여백
export const PIN = {
  width: 44,
  height: 42,
  /** 아이콘 안에서 핀 끝(뾰족한 곳)의 y */
  tipY: 40.25,
  /** 라벨 말풍선 위쪽 = 핀 끝 - 68 (피그마: 라벨 214, 핀 끝 282) */
  labelOffset: 68,
  labelHeight: 24,
} as const;

/** 라벨이 헤드라인과 겹치지 않도록 핀 끝이 인트로 아래로 떨어져 있어야 하는 거리 */
const LABEL_CLEARANCE = PIN.labelOffset + 8;
/** 핀 아래 글로우까지 보이도록 시트 위쪽과 띄울 거리 */
const SHEET_CLEARANCE = 30;

export type HomeGeometry = {
  width: number;
  height: number;
  appBarTop: number;
  introTop: number;
  actionsTop: number;
  /** 01 상태(큰 지도) 이미지 상자 중심·크기 */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** 02~04 상태(작은 지도)로 갈 때의 변환 (지도 중심 기준) */
  smallScale: number;
  smallDx: number;
  smallDy: number;
  /** 시트를 가장 크게 펼칠 수 있는 높이 */
  maxExpanded: number;
};

/** 홈 화면(탭바 위 영역) 크기와 상태바 높이로 지도·버튼 위치를 계산합니다. */
export function computeHomeGeometry(width: number, height: number, topInset: number): HomeGeometry {
  const s = Math.min(1.12, Math.max(0.85, width / FIGMA.width));
  const appBarTop = topInset + FIGMA.appBarGap;
  const introTop = appBarTop + FIGMA.appBarHeight + FIGMA.introGap;
  const actionsTop = height - FIGMA.actionsBottomGap - FIGMA.actionsHeight;

  // 큰 지도: 인트로와 버튼 사이에 들어가는 만큼 (피그마 위 3·아래 9 여백)
  const areaTop = introTop + FIGMA.introHeight + 3;
  const areaBottom = actionsTop - 9;
  const maxWidth = width - screenPadding;
  const h = Math.max(160, Math.min(FIGMA.bigMapHeight * s, areaBottom - areaTop, maxWidth / MAP_ASPECT));
  const w = h * MAP_ASPECT;
  const ratio = w / FIGMA.bigMapWidth;
  const cx = width / 2 + FIGMA.bigMapOffsetX * ratio;
  const cy = (areaTop + areaBottom) / 2;

  // 작은 지도: 인트로 시작에서 99 아래, 중심이 23 왼쪽
  const smallH = h * FIGMA.smallScale;
  const smallCy = introTop + FIGMA.smallTopFromIntro + smallH / 2;

  return {
    width,
    height,
    appBarTop,
    introTop,
    actionsTop,
    cx,
    cy,
    w,
    h,
    smallScale: FIGMA.smallScale,
    smallDx: FIGMA.smallOffsetX * ratio,
    smallDy: smallCy - cy,
    maxExpanded: Math.max(SHEET.compact + SHEET.minExpandedExtra, Math.min(height - introTop - 60, 540)),
  };
}

/**
 * 결과 화면에서 핀이 헤드라인과 시트 사이에 보이도록 지도를 위아래로 옮길 거리.
 * 남쪽 지역(제주·부산 등)은 위로, 최북단 지역은 아래로 조금 움직입니다.
 */
export function computeFocusShift(geo: HomeGeometry, v: number, introBottom: number, sheetHeight: number, extraScale = 1) {
  const k = geo.smallScale * extraScale;
  const tip = geo.cy + geo.smallDy + (v - 0.5) * geo.h * k;
  const minTip = introBottom + LABEL_CLEARANCE;
  const maxTip = geo.height - sheetHeight - SHEET_CLEARANCE;
  if (tip < minTip) return minTip - tip;
  // 둘 다 만족할 수 없으면 라벨이 헤드라인을 가리지 않는 쪽을 우선합니다 (시트가 핀을 조금 덮음).
  if (tip > maxTip) return Math.max(maxTip - tip, minTip - tip);
  return 0;
}

/**
 * 03 헤드라인 "이번엔, {이름} 어때요?"(Headline 30/41)가 한 줄에 들어가는지 미리 어림해 인트로 높이를 구합니다.
 * 핀이 떨어지기 전에 지도 위치를 정해야 해서 측정 대신 글자 폭으로 계산합니다.
 */
export function estimateFoundIntroHeight(name: string, width: number) {
  const text = `이번엔, ${name} 어때요?`;
  const textWidth = [...text].reduce((sum, ch) => sum + (/[가-힣]/.test(ch) ? 29 : ch === " " ? 7.5 : 15), 0);
  const lines = textWidth > width - screenPadding * 2 ? 2 : 1;
  return lines * 41 + 8 + 22;
}

export type MapTransform = { k: number; tx: number; ty: number };

/** 지도 변환 (UI 스레드). progress 0 = 큰 지도(01), 1 = 작은 지도(02~04). sheetIndex -1 닫힘 · 0 접힘 · 1 펼침 */
export function mapTransform(
  geo: HomeGeometry,
  progress: number,
  sheetIndex: number,
  focusCompact: number,
  focusExpanded: number,
): MapTransform {
  "worklet";
  const sheetScale = interpolate(sheetIndex, [0, 1], [1, SHEET.expandedMapScale], Extrapolation.CLAMP);
  const k = interpolate(progress, [0, 1], [1, geo.smallScale]) * sheetScale;
  const focus = interpolate(sheetIndex, [-1, 0, 1], [0, focusCompact, focusExpanded], Extrapolation.CLAMP);
  return { k, tx: progress * geo.smallDx, ty: progress * geo.smallDy + focus };
}

/** 지도 위 0~1 좌표 → 화면 좌표 (UI 스레드) */
export function projectOnScreen(geo: HomeGeometry, t: MapTransform, u: number, v: number) {
  "worklet";
  return { x: geo.cx + t.tx + (u - 0.5) * geo.w * t.k, y: geo.cy + t.ty + (v - 0.5) * geo.h * t.k };
}
