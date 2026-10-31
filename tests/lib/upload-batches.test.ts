// 여행기 사진 올리기: 서버 한 요청 한도(100MB, backend #121) 안에서 묶음으로 나누는지 확인합니다.
import { uploadBatches } from "@/features/diary/lib";

const MB = 1024 * 1024;
const files = (sizes: number[]) => sizes.map((mb, i) => ({ id: i, size: mb * MB }));

describe("여행기 사진 묶음 올리기", () => {
  it("합계 90MB를 넘기 전에 다음 묶음으로 넘어갑니다 (고른 순서 유지)", () => {
    const batches = uploadBatches(files([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]), 90 * MB, 30);
    expect(batches.map((b) => b.length)).toEqual([11, 1]);
    expect(batches.flat().map((f) => f.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("한 묶음은 기본 10장까지입니다", () => {
    expect(uploadBatches(files(Array(25).fill(1))).map((b) => b.length)).toEqual([10, 10, 5]);
  });

  it("작은 사진 몇 장은 한 번에 올립니다", () => {
    expect(uploadBatches(files([2, 3, 4]))).toHaveLength(1);
  });
});
