import { create } from "zustand";

import type { Transport } from "@/api/types";

// 핀 먼저 흐름: 홈에서 뽑은 지역을 여행(POST /trips)이 만들어지기 전까지 들고 있습니다.
// 여행을 만든 뒤에는 POST /trips/{id}/region (mode MANUAL)로 이 지역을 저장합니다.
export type DraftRegion = { sigCd: string; province: string; city: string; centerLat: number; centerLng: number };

type TripDraftState = {
  region: DraftRegion | null;
  startDate: string | null;
  nights: number | null;
  transport: Transport;
  /** 만들어진 여행 id (날짜 선택 완료 시 생성) */
  tripId: number | null;
  setRegion: (region: DraftRegion | null) => void;
  setDates: (startDate: string, nights: number) => void;
  setTransport: (transport: Transport) => void;
  setTripId: (tripId: number) => void;
  reset: () => void;
};

const initial = { region: null, startDate: null, nights: null, transport: "PUBLIC_TRANSIT" as Transport, tripId: null };

export const useTripDraft = create<TripDraftState>((set) => ({
  ...initial,
  setRegion: (region) => set({ region }),
  setDates: (startDate, nights) => set({ startDate, nights }),
  setTransport: (transport) => set({ transport }),
  setTripId: (tripId) => set({ tripId }),
  reset: () => set(initial),
}));
