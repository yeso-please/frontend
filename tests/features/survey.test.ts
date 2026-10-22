import type { OnboardingQuestions } from "@/api/types";
import {
  answeredCount,
  buildSteps,
  buildSubmission,
  emptyAnswers,
  firstUnanswered,
  motiveLabel,
  snapToValue,
  toggleMotive,
} from "@/features/onboarding/survey";

const style = (number: number) => ({ number, leftPole: "왼쪽", rightPole: "오른쪽", minValue: 1, maxValue: 7, neutralValue: 4, evidence: "OFFICIAL" as const });
const questions: OnboardingQuestions = {
  questionVersion: "aihub-traveler-v2",
  travelStyles: [style(1), style(3), style(5), style(6)],
  travelMotives: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((code) => ({ code, label: `동기${code}` })),
  maxTravelMotives: 3,
  maxLikedRegions: 3,
  excludeTags: ["물놀이"],
  scheduleDensityOptions: ["RELAXED", "PACKED"],
  mbtiQuestions: Array.from({ length: 12 }, (_, i) => ({
    number: i + 1,
    question: `질문${i + 1}`,
    choices: [
      { choice: 1 as const, label: "가" },
      { choice: 2 as const, label: "나" },
    ],
  })),
};

describe("5단 슬라이더", () => {
  it("칸을 1·3·4·5·7로 보냅니다", () => {
    expect([0, 1, 2, 3, 4].map(snapToValue)).toEqual([1, 3, 4, 5, 7]);
    expect(snapToValue(-3)).toBe(1);
    expect(snapToValue(9)).toBe(7);
  });
});

describe("설문 순서와 완료", () => {
  const steps = buildSteps(questions);

  it("성향 4 → MBTI 12 → 동기 순서이고 진행 번호를 매깁니다", () => {
    expect(steps).toHaveLength(17);
    expect(steps.slice(0, 4).map((s) => s.key)).toEqual(["style:1", "style:3", "style:5", "style:6"]);
    expect(steps[4]).toMatchObject({ kind: "mbti", order: 1, total: 12 });
    expect(steps[16].key).toBe("motives");
  });

  it("가운데 칸도 직접 눌러야 답한 것으로 봅니다", () => {
    const answers = emptyAnswers();
    expect(firstUnanswered(steps, answers)?.key).toBe("style:1");
    answers.styles["1"] = 4;
    expect(firstUnanswered(steps, answers)?.key).toBe("style:3");
    expect(answeredCount(steps, answers)).toBe(1);
  });

  it("모두 답하면 남은 문항이 없습니다", () => {
    const answers = {
      styles: { 1: 1, 3: 3, 5: 5, 6: 7 },
      mbti: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), (i % 2) + 1])) as Record<string, 1 | 2>,
      motives: [2],
    };
    expect(firstUnanswered(steps, answers)).toBeNull();
    expect(answeredCount(steps, answers)).toBe(17);
  });

  it("MBTI 문항이 없는 서버(v1)면 성향 다음 바로 동기", () => {
    expect(buildSteps({ travelStyles: questions.travelStyles }).map((s) => s.kind)).toEqual(["style", "style", "style", "style", "motives"]);
  });
});

describe("여행 동기", () => {
  it("최대 3개, 넘기면 그대로 두고 limited", () => {
    expect(toggleMotive([1, 2], 3, 3)).toEqual({ next: [1, 2, 3], limited: false });
    expect(toggleMotive([1, 2, 3], 4, 3)).toEqual({ next: [1, 2, 3], limited: true });
    expect(toggleMotive([1, 2, 3], 2, 3)).toEqual({ next: [1, 3], limited: false });
  });

  it("코드 5는 화면에서만 '사진 남기기'", () => {
    expect(motiveLabel({ code: 5, label: "SNS에 올릴 사진" })).toBe("사진 남기기");
    expect(motiveLabel({ code: 2, label: "휴식과 재충전" })).toBe("휴식과 재충전");
  });
});

describe("제출 본문", () => {
  it("v2: 밀도 없이 MBTI 답·빈 지역·빈 제외를 보냅니다", () => {
    const body = buildSubmission(questions, {
      styles: { 1: 1, 3: 3, 5: 5, 6: 7 },
      mbti: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 2])) as Record<string, 1 | 2>,
      motives: [5, 7],
    });
    expect(body).toEqual({
      questionVersion: "aihub-traveler-v2",
      travelStyles: { 1: 1, 3: 3, 5: 5, 6: 7 },
      travelMotives: [5, 7],
      likedRegions: [],
      excludeTags: [],
      mbtiAnswers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 2])),
    });
    expect(body).not.toHaveProperty("scheduleDensity");
  });

  it("v1(MBTI 없음)이면 mbtiAnswers를 넣지 않습니다", () => {
    const body = buildSubmission({ ...questions, mbtiQuestions: undefined }, { styles: { 1: 4, 3: 4, 5: 4, 6: 4 }, mbti: {}, motives: [1] });
    expect(body).not.toHaveProperty("mbtiAnswers");
  });
});
