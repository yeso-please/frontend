import { create } from "zustand";

import type { RegionSelection } from "@/api/types";

// 지역 먼저 흐름 (D1): 여행 탭에서 뽑거나 고른 지역을 여행(POST /trips)이 만들어지기 전까지 들고 있습니다.
// 날짜를 고르면 POST /trips/context/check(sigCd)로 확인하고 POST /trips(regionSigCd·regionSelection)로 한 번에 저장합니다.
export type DraftRegion = { sigCd: string; province: string; city: string; lat: number; lng: number };

type TripDraftState = {
  region: DraftRegion | null;
  /** 지역을 정한 방식 — 서버 추첨 결과(regionSelection) 또는 지도·목록에서 직접 고르면 MANUAL */
  regionSelection: RegionSelection;
  /** 7-5 추첨 결과의 최대 박수(0~6). 직접 고른 지역은 모르므로 null (날짜 확인 API의 regionEligible로 판단) */
  maxNights: number | null;
  startDate: string | null;
  nights: number | null;
  /** 만들어진 여행 id (날짜 선택 완료 시 생성) */
  tripId: number | null;
  setRegion: (region: DraftRegion, selection: RegionSelection, maxNights: number | null) => void;
  setDates: (startDate: string, nights: number) => void;
  setTripId: (tripId: number) => void;
  reset: () => void;
};

const initial = {
  region: null,
  regionSelection: "MANUAL" as RegionSelection,
  maxNights: null,
  startDate: null,
  nights: null,
  tripId: null,
};

export const useTripDraft = create<TripDraftState>((set) => ({
  ...initial,
  // 다른 지역을 고르면 이전 여행 준비(날짜·만든 여행)는 이어 쓰지 않습니다.
  setRegion: (region, regionSelection, maxNights) => set({ ...initial, region, regionSelection, maxNights }),
  setDates: (startDate, nights) => set({ startDate, nights }),
  setTripId: (tripId) => set({ tripId }),
  reset: () => set(initial),
}));
