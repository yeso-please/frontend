// 여행 탭 지도 배치가 피그마 B1·B2·B3(390×844, 상태바 50·탭바 78) 실측과 맞는지 확인합니다.
import { computeDiscoverGeometry, mapTransform, projectOnScreen } from "@/features/discover/lib/geometry";
import { projectToMap } from "@/lib/mapProjection";

// geometry는 UI 스레드용 interpolate만 쓰므로 네이티브 모듈 없이 같은 계산을 하는 대역으로 바꿉니다 (jest.mock은 import보다 먼저 실행됨).
jest.mock("react-native-reanimated", () => {
  const interpolate = (x: number, input: number[], output: number[], extrapolate?: string) => {
    let i = 0;
    while (i < input.length - 2 && x > input[i + 1]) i += 1;
    const t = (x - input[i]) / (input[i + 1] - input[i]);
    const clamped = extrapolate === "clamp" ? Math.min(1, Math.max(0, t)) : t;
    return output[i] + (output[i + 1] - output[i]) * clamped;
  };
  return { interpolate, Extrapolation: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" } };
});

// 피그마 프레임과 같은 조건: 탭바 위 영역 766, 상태바 50
const geo = computeDiscoverGeometry(390, 766, 50);
const near = (a: number, b: number, tol = 1.5) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe("여행 탭 지도 배치", () => {
  it("B1: 지도 상자 329×397, 버튼은 y652, 조건 카드·확대 창 기준선이 피그마와 같습니다", () => {
    near(geo.w, 329);
    near(geo.h, 397);
    near(geo.cy, 438.5);
    expect(geo.actionsTop).toBe(652);
    expect(geo.introTop).toBe(118);
    near(geo.viewportTop, 208);
    expect(geo.sheetTop).toBe(478);
  });

  it("B2: 지도가 378 폭으로 커지고 위쪽이 y214에 옵니다", () => {
    const t = mapTransform(geo, 1, 0.5, 0.5);
    near(geo.w * t.k, 378);
    near(geo.cy + t.ty - (geo.h * t.k) / 2, 214);
  });

  it("B3: 강릉에 꽂힌 핀 끝이 (229, 325)이고 확대 지도의 왼쪽·위가 피그마(-311, 84)와 같습니다", () => {
    const p = projectToMap(37.75, 128.88);
    const t = mapTransform(geo, 2, p.x, p.y);
    const tip = projectOnScreen(geo, t, p.x, p.y);
    near(tip.x, 229, 12);
    near(tip.y, 325, 12);
    near(geo.cx + t.tx - (geo.w * t.k) / 2, -311, 40);
    near(geo.cy + t.ty - (geo.h * t.k) / 2, 84, 40);
  });

  it("B3: 가장자리 지역(울릉·옹진·제주)도 확대한 지도가 화면 창을 다 덮습니다", () => {
    for (const [lat, lng] of [
      [37.5, 130.9],
      [37.45, 125.9],
      [33.3, 126.58],
      [38.4, 128.45],
    ]) {
      const p = projectToMap(lat, lng);
      const t = mapTransform(geo, 2, p.x, p.y);
      const left = geo.cx + t.tx - (geo.w * t.k) / 2;
      const top = geo.cy + t.ty - (geo.h * t.k) / 2;
      expect(left).toBeLessThanOrEqual(0.5);
      expect(left + geo.w * t.k).toBeGreaterThanOrEqual(389.5);
      expect(top).toBeLessThanOrEqual(geo.viewportTop + 0.5);
      expect(top + geo.h * t.k).toBeGreaterThanOrEqual(geo.sheetTop - 0.5);
    }
  });
});
