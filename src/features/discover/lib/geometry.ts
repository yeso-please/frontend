import { Extrapolation, interpolate } from "react-native-reanimated";

import { MAP_IMAGE } from "@/lib/mapProjection";

// 피그마 B1·B2·B3 (390×844 프레임) 실측값. 기기 크기에 맞춰 비율로 늘이고 줄입니다.
// korea-terrain.webp는 Korea terrain(329×410.78 @B1) 중 위아래 8/472씩 잘린 부분이라 B1에서 329×397 상자입니다.
const FIGMA = {
  width: 390,
  /** 상태바 아래 → 앱바 (y56 - 상태바 50) */
  appBarGap: 6,
  appBarHeight: 44,
  /** 앱바 아래 → 인트로 (y118 - 100) */
  introGap: 18,
  /** B1 인트로 높이(제목 36 + 8 + 부제 22 + 여유) → 지도 영역 시작 (y233) */
  idleAreaFromIntro: 115,
  /** B1 지도 상자 329×397, 중심 (194.5, 438.5) — 지도 영역(233~651) 가운데보다 3.5 위 */
  idleMapWidth: 329,
  idleMapHeight: 397,
  idleMapOffsetX: -0.5,
  idleMapOffsetY: -3.5,
  /** B2 지도 상자 378×456, 중심 (195, 442) */
  drawingScale: 378 / 329,
  drawingOffsetY: 3.5,
  /** B3 확대 지도 735 폭 · 핀 끝 (229, 325) · 지도 창 위쪽 208 · 시트 위쪽 478 */
  foundScale: 735 / 329,
  foundTipOffsetX: 229 - 195,
  /** 인트로 시작(118) ~ 시트 위(478) 사이에서 핀 끝(325)의 위치 비율 */
  foundTipRatio: (325 - 118) / (478 - 118),
  foundViewportFromIntro: 208 - 118,
  /** 하단 버튼 영역: 46 + 4 + 44, 탭바 위 20 */
  actionsHeight: 94,
  actionsBottomGap: 20,
} as const;

const MAP_ASPECT = MAP_IMAGE.width / MAP_IMAGE.height;

/** 피그마 Destination sheet h288 (탭바 바로 위) */
export const SHEET = { height: 288 } as const;

// 핀(44×42 아이콘) 끝점 기준 값. B3에서는 피그마 Destination pin 56 폭에 맞춰 키웁니다.
export const PIN = {
  width: 44,
  height: 42,
  /** 아이콘 안에서 핀 끝(뾰족한 곳)의 y */
  tipY: 40.25,
  foundScale: 56 / 44,
  /** 라벨 말풍선: 핀 머리 오른쪽, 핀 끝보다 44 위 (피그마 B3 Selected destination 260,281) */
  labelHeight: 24,
  labelGap: 6,
  labelRise: 44,
} as const;

export type DiscoverGeometry = {
  width: number;
  height: number;
  appBarTop: number;
  introTop: number;
  actionsTop: number;
  /** B1(기본 지도) 이미지 상자 중심·크기 */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** 피그마 대비 배율 (지도 상자 폭 / 329) */
  ratio: number;
  /** B2 배율·이동 */
  k1: number;
  dx1: number;
  dy1: number;
  /** B3 배율과 핀 끝이 놓일 화면 위치 */
  k2: number;
  tipX: number;
  tipY: number;
  /** B3에서 지도를 보여 주는 창 (위쪽은 인트로 뒤 흰 가림막, 아래는 시트) */
  viewportTop: number;
  sheetTop: number;
};

/** 여행 탭(탭바 위 영역) 크기와 상태바 높이로 지도·버튼 위치를 계산합니다. */
export function computeDiscoverGeometry(width: number, height: number, topInset: number): DiscoverGeometry {
  const s = Math.min(1.12, Math.max(0.85, width / FIGMA.width));
  const appBarTop = topInset + FIGMA.appBarGap;
  const introTop = appBarTop + FIGMA.appBarHeight + FIGMA.introGap;
  const actionsTop = height - FIGMA.actionsBottomGap - FIGMA.actionsHeight;

  // B1: 인트로와 버튼 사이에 들어가는 만큼 (작은 화면은 줄입니다)
  const areaTop = introTop + FIGMA.idleAreaFromIntro;
  const areaBottom = actionsTop - 1;
  const h = Math.max(180, Math.min(FIGMA.idleMapHeight * s, areaBottom - areaTop - 8, (width - 40) / MAP_ASPECT));
  const w = h * MAP_ASPECT;
  const ratio = w / FIGMA.idleMapWidth;
  const cx = width / 2 + FIGMA.idleMapOffsetX * ratio;
  const cy = (areaTop + areaBottom) / 2 + FIGMA.idleMapOffsetY * ratio;

  // B2: 버튼이 내려가 비는 자리까지 지도가 커집니다 (아래로 넘치지 않게)
  const dy1 = FIGMA.drawingOffsetY * ratio;
  const k1 = Math.max(1, Math.min(FIGMA.drawingScale, ((height - 8 - (cy + dy1)) * 2) / h));

  // B3: 지역 쪽으로 크게 확대 — 핀 끝이 인트로와 시트 사이(피그마 비율)에 오도록
  const sheetTop = height - SHEET.height;
  const tipY = introTop + (sheetTop - introTop) * FIGMA.foundTipRatio;

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
    ratio,
    k1,
    dx1: -FIGMA.idleMapOffsetX * ratio,
    dy1,
    k2: FIGMA.foundScale,
    tipX: width / 2 + FIGMA.foundTipOffsetX * ratio,
    tipY,
    viewportTop: introTop + FIGMA.foundViewportFromIntro * ratio,
    sheetTop,
  };
}

export type MapTransform = { k: number; tx: number; ty: number };

/** 지도 위 0~1 좌표 → 화면 좌표 (UI 스레드) */
export function projectOnScreen(geo: DiscoverGeometry, t: MapTransform, u: number, v: number) {
  "worklet";
  return { x: geo.cx + t.tx + (u - 0.5) * geo.w * t.k, y: geo.cy + t.ty + (v - 0.5) * geo.h * t.k };
}

/** B3 최종 변환: 초점(뽑힌 지역)이 핀 자리(tipX, tipY)에 오되, 확대한 그림이 화면 창을 다 덮도록 밀어 둡니다. */
function foundTranslate(geo: DiscoverGeometry, u: number, v: number) {
  "worklet";
  const k = geo.k2;
  const halfW = (geo.w * k) / 2;
  const halfH = (geo.h * k) / 2;
  let tx = geo.tipX - geo.cx - (u - 0.5) * geo.w * k;
  let ty = geo.tipY - geo.cy - (v - 0.5) * geo.h * k;
  // 좌우: 그림 왼쪽 끝 ≤ 0, 오른쪽 끝 ≥ 화면 폭 (울릉·옹진처럼 가장자리 지역은 핀이 옆으로 비켜 섭니다)
  tx = Math.min(tx, halfW - geo.cx);
  tx = Math.max(tx, geo.width - geo.cx - halfW);
  // 위아래: 그림이 지도 창(가림막 아래 ~ 시트 위)을 덮도록
  ty = Math.min(ty, geo.viewportTop - geo.cy + halfH);
  ty = Math.max(ty, geo.sheetTop - geo.cy - halfH);
  return { tx, ty };
}

/**
 * 지도 변환 (UI 스레드). zoom 0 = B1 기본 지도, 1 = B2 핀 모드, 2 = B3 지역 발견.
 * 1→2 확대 중에는 초점의 화면 위치를 직선으로 옮겨 확대 내내 그 지역이 미끄러지듯 다가오게 합니다.
 */
export function mapTransform(geo: DiscoverGeometry, zoom: number, focusU: number, focusV: number): MapTransform {
  "worklet";
  const k = interpolate(zoom, [0, 1, 2], [1, geo.k1, geo.k2], Extrapolation.CLAMP);
  if (zoom <= 1) {
    const f = Math.max(0, zoom);
    return { k, tx: geo.dx1 * f, ty: geo.dy1 * f };
  }
  const f = Math.min(1, zoom - 1);
  // 확대 전(B2) 초점의 화면 위치 → 확대 후(B3) 위치
  const fromX = geo.cx + geo.dx1 + (focusU - 0.5) * geo.w * geo.k1;
  const fromY = geo.cy + geo.dy1 + (focusV - 0.5) * geo.h * geo.k1;
  const end = foundTranslate(geo, focusU, focusV);
  const toX = geo.cx + end.tx + (focusU - 0.5) * geo.w * geo.k2;
  const toY = geo.cy + end.ty + (focusV - 0.5) * geo.h * geo.k2;
  const px = fromX + (toX - fromX) * f;
  const py = fromY + (toY - fromY) * f;
  return { k, tx: px - geo.cx - (focusU - 0.5) * geo.w * k, ty: py - geo.cy - (focusV - 0.5) * geo.h * k };
}
