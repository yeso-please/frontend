// 다른 계정으로 로그인했을 때 이전 사람의 지역 뽑기 결과·여행 초안이 남지 않는지 확인합니다 (FRONT 요청서 2026-10-30 #1).
import { type DiscoveredRegion } from "@/features/discover/lib/regions";
import { useDiscoverDraw } from "@/features/discover/store";
import { useAuthStore } from "@/store/auth";
import { useTripDraft } from "@/store/tripDraft";

const goheung: DiscoveredRegion = {
  sigCd: "46770",
  province: "전라남도",
  city: "고흥군",
  name: "고흥",
  lat: 34.6,
  lng: 127.28,
  u: 0.4,
  v: 0.8,
  selection: "RANDOM",
  maxNights: 2,
};

describe("사용자별 전역 상태", () => {
  it("로그아웃(세션 만료 포함)하면 지역 뽑기 결과와 여행 만들기 초안을 비웁니다", () => {
    useDiscoverDraw.getState().land(goheung);
    useTripDraft.getState().setRegion({ sigCd: goheung.sigCd, province: goheung.province, city: goheung.city, lat: goheung.lat, lng: goheung.lng }, "RANDOM", 2);

    useAuthStore.getState().signOut();

    expect(useDiscoverDraw.getState().result).toBeNull();
    expect(useDiscoverDraw.getState().phase).toBe("idle");
    expect(useTripDraft.getState().region).toBeNull();
  });
});
