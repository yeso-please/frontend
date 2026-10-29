import { type RegionShape, REGION_SHAPES } from "./koreaMap.generated";

// 경계 데이터는 2022년 시군구 코드입니다. 그 뒤 바뀐 코드는 같은 땅의 옛 코드로 찾습니다.
// 강원특별자치도(2023, 42→51)·전북특별자치도(2024, 45→52)는 앞 두 자리만 바뀌었습니다.
const RENAMED_PROVINCE: Record<string, string> = { "51": "42", "52": "45" };
const RENAMED: Record<string, string> = {
  // 군위군 대구 편입 (2023)
  "27720": "47720",
  // 부천시 구 부활 (2024)
  "41192": "41190",
  "41194": "41190",
  "41196": "41190",
};

/** 옛 코드로 바꾼 sigCd (경계 데이터 조회용) */
export const legacySigCd = (sigCd: string) => RENAMED[sigCd] ?? (RENAMED_PROVINCE[sigCd.slice(0, 2)] ? RENAMED_PROVINCE[sigCd.slice(0, 2)] + sigCd.slice(2) : sigCd);

/** 시군구 외곽선·핀 자리 (모르는 코드면 undefined — 핀은 위경도로, 외곽선은 그리지 않음) */
export const regionShape = (sigCd: string): RegionShape | undefined => REGION_SHAPES[sigCd] ?? REGION_SHAPES[legacySigCd(sigCd)];
