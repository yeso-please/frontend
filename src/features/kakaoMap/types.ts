/**
 * 지도에 올리는 점.
 * - current: 지금 고른 장소(초록 핀) · candidate: 대체 후보(파란 번호) · course: 코스 방문 순서(초록 번호)
 * - meal: 식당을 고른 식사(민트 번호) · origin: 식당 검색 기준점(작은 점)
 */
export type MapMarkerKind = "current" | "candidate" | "course" | "meal" | "origin";

export type MapMarker = {
  /** onMarkerPress로 돌려받는 값 */
  id: string;
  lat: number;
  lng: number;
  kind: MapMarkerKind;
  /** 원 안에 쓰는 번호 (없으면 label) */
  number?: number;
  /** 번호가 없을 때 짧은 글자. 웹뷰에서 textContent로만 그립니다 */
  label?: string;
  selected?: boolean;
};

export type MapLineColor = "green" | "blue" | "muted";

export type MapPolyline = {
  id: string;
  /** [위도, 경도] 점 목록 */
  path: [number, number][];
  /** 직선 추정 구간은 점선 */
  dashed?: boolean;
  color?: MapLineColor;
};

/** RN → 웹뷰 한 번 그리기 */
export type MapRenderPayload = {
  markers: MapMarker[];
  polylines: MapPolyline[];
  /** true면 모든 점이 보이게 범위를 다시 맞춥니다 */
  fit: boolean;
  /** fit이 아닐 때 이 점으로 부드럽게 이동 */
  focusId: string | null;
};

/** 웹뷰 → RN 메시지 */
export type MapMessage =
  | { type: "ready" }
  | { type: "markerPress"; id: string }
  | { type: "error"; reason: "sdk" | "timeout" | "render" | "init" };
