import { formatDotRange, joinNicknames, regionLabelFromName, tripCardTitle } from "@/features/trip/lib";
import { PREP_STEP_LABEL, prepStep, prepStepHref } from "@/features/trip/prepStep";
import { pendingInviteToken, usePendingInvite } from "@/store/pendingInvite";

describe("여행 준비 단계 (frontend-guide 준비 단계 계산)", () => {
  const base = { regionSigCd: "51150", participantCount: 1, sentInviteCount: 0, hasCourse: false };

  it("앞에서부터 처음 안 된 단계가 지금 할 일입니다", () => {
    expect(prepStep({ ...base, regionSigCd: null })).toBe("region");
    expect(prepStep(base)).toBe("invite");
    expect(prepStep({ ...base, participantCount: 2 })).toBe("course");
    expect(prepStep({ ...base, sentInviteCount: 1 })).toBe("course");
    expect(prepStep({ ...base, participantCount: 3, hasCourse: true })).toBe("done");
  });

  it("혼자 떠나기로 하고 코스까지 만든 여행은 초대 단계에 머물지 않습니다", () => {
    expect(prepStep({ ...base, hasCourse: true })).toBe("done");
  });

  it("칩 문구와 이어서 준비하기 경로", () => {
    expect(PREP_STEP_LABEL.course).toBe("코스 만드는 중");
    expect(prepStepHref(7, "invite")).toEqual({ pathname: "/trip/[tripId]/invite", params: { tripId: "7" } });
    expect(prepStepHref(7, "course")).toEqual({ pathname: "/trip/[tripId]", params: { tripId: "7" } });
    expect(prepStepHref(7, "region").pathname).toBe("/trip/[tripId]");
  });
});

describe("홈 카드 표시", () => {
  it("서버 regionName을 짧은 지역 이름으로 바꿉니다", () => {
    expect(regionLabelFromName("강원특별자치도 강릉시")).toBe("강릉");
    expect(regionLabelFromName("경기도 수원시 장안구")).toBe("수원 장안구");
    expect(regionLabelFromName("서울특별시 종로구")).toBe("서울 종로구");
    expect(regionLabelFromName(null)).toBeNull();
    expect(regionLabelFromName("  ")).toBeNull();
  });

  it("지역이 있으면 '강릉 여행', 없으면 서버 대체 제목", () => {
    expect(tripCardTitle("강원특별자치도 강릉시", "10월 17일부터 2박 3일 여행")).toBe("강릉 여행");
    expect(tripCardTitle(null, "10월 17일부터 2박 3일 여행")).toBe("10월 17일부터 2박 3일 여행");
  });

  it("요일 없는 기간과 닉네임 줄", () => {
    expect(formatDotRange("2026-10-17", "2026-10-19")).toBe("10.17 – 10.19");
    expect(formatDotRange("2026-10-17", "2026-10-17")).toBe("10.17");
    expect(joinNicknames(["수정", "서현"])).toBe("수정 · 서현");
    expect(joinNicknames(["가", "나", "다", "라", "마"])).toBe("가 · 나 · 다 외 2명");
  });
});

describe("비로그인 초대 토큰", () => {
  afterEach(() => usePendingInvite.getState().clear());

  it("기억한 토큰을 돌려주고, 7일이 지나면 버립니다", () => {
    usePendingInvite.getState().remember("iv_abc");
    const savedAt = usePendingInvite.getState().savedAt as number;
    expect(pendingInviteToken(savedAt + 1000)).toBe("iv_abc");
    expect(pendingInviteToken(savedAt + 8 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it("지우면 없습니다", () => {
    usePendingInvite.getState().remember("iv_abc");
    usePendingInvite.getState().clear();
    expect(pendingInviteToken()).toBeNull();
  });
});
