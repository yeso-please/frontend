import type { MbtiQuestion, OnboardingQuestions, OnboardingSubmissionRequest, TravelMotive, TravelStyleQuestion } from "@/api/types";

// 피그마 초안 C1a · 한 페이지 세로 스크롤 설문의 순수 로직 (화면 없이 테스트합니다).
// 순서: 여행 성향 4문항(5단 슬라이더) → 여행 MBTI 12문항(두 선택지) → 여행 동기(최대 3개).

/** 5단 슬라이더 칸 → 서버 1~7 값. 양 끝은 "매우", 안쪽 칸은 "조금", 가운데 4는 중립 (사용자 결정 2026-10-21) */
export const SNAP_VALUES = [1, 3, 4, 5, 7] as const;
export const SNAP_COUNT = SNAP_VALUES.length;
export const NEUTRAL_SNAP = 2;

export const snapToValue = (index: number) => SNAP_VALUES[Math.min(Math.max(Math.round(index), 0), SNAP_COUNT - 1)];

/** 서버 문항 번호별 화면 문구 (피그마 확정 C1~C4). 양 끝 라벨은 서버 leftPole·rightPole을 그대로 씁니다 */
const STYLE_COPY: Record<number, { kicker: string; question: string }> = {
  1: { kicker: "여행지 분위기", question: "어떤 여행지가\n더 끌려요?" },
  3: { kicker: "새로운 장소", question: "새로운 곳을\n만나는 건 어때요?" },
  5: { kicker: "여행에서의 활동", question: "여행에서\n더 기대하는 건?" },
  6: { kicker: "가고 싶은 곳", question: "숨은 곳과 명소,\n어디에 더 끌려요?" },
};

export function styleCopy(question: TravelStyleQuestion) {
  return STYLE_COPY[question.number] ?? { kicker: "여행 취향", question: `${question.leftPole}와 ${question.rightPole},\n어느 쪽이 더 좋아요?` };
}

/** 여행 동기 코드 5는 화면에서만 "사진 남기기"로 보여 줍니다 (D18 — API 라벨은 그대로) */
export const motiveLabel = (motive: TravelMotive) => (motive.code === 5 ? "사진 남기기" : motive.label);

export type SurveyAnswers = {
  /** 문항 번호 → 1~7. 아직 답하지 않은 문항은 키가 없습니다 (가운데 칸도 직접 눌러야 답한 것) */
  styles: Record<string, number>;
  /** 문항 번호 → 1 | 2 */
  mbti: Record<string, 1 | 2>;
  motives: number[];
};

export const emptyAnswers = (): SurveyAnswers => ({ styles: {}, mbti: {}, motives: [] });

export type SurveyStep =
  | { key: string; kind: "style"; question: TravelStyleQuestion; order: number; total: number }
  | { key: string; kind: "mbti"; question: MbtiQuestion; order: number; total: number }
  | { key: "motives"; kind: "motives" };

/** 화면 위에서 아래로 답할 순서 */
export function buildSteps(questions: Pick<OnboardingQuestions, "travelStyles" | "mbtiQuestions">): SurveyStep[] {
  const styles = questions.travelStyles;
  const mbti = questions.mbtiQuestions ?? [];
  return [
    ...styles.map((question, i) => ({ key: `style:${question.number}`, kind: "style" as const, question, order: i + 1, total: styles.length })),
    ...mbti.map((question, i) => ({ key: `mbti:${question.number}`, kind: "mbti" as const, question, order: i + 1, total: mbti.length })),
    { key: "motives" as const, kind: "motives" as const },
  ];
}

export function isStepAnswered(step: SurveyStep, answers: SurveyAnswers): boolean {
  if (step.kind === "style") return answers.styles[String(step.question.number)] !== undefined;
  if (step.kind === "mbti") return answers.mbti[String(step.question.number)] !== undefined;
  return answers.motives.length > 0;
}

/** 아직 답하지 않은 첫 문항 (모두 답했으면 null) */
export const firstUnanswered = (steps: SurveyStep[], answers: SurveyAnswers) => steps.find((s) => !isStepAnswered(s, answers)) ?? null;

export const answeredCount = (steps: SurveyStep[], answers: SurveyAnswers) => steps.filter((s) => isStepAnswered(s, answers)).length;

/** 동기는 최대 max개. 이미 고른 것을 누르면 빼고, 한도를 넘으면 그대로 둡니다 */
export function toggleMotive(selected: number[], code: number, max: number): { next: number[]; limited: boolean } {
  if (selected.includes(code)) return { next: selected.filter((c) => c !== code), limited: false };
  if (selected.length >= max) return { next: selected, limited: true };
  return { next: [...selected, code], limited: false };
}

/**
 * POST /onboarding/submissions 본문 (aihub-traveler-v2).
 * scheduleDensity는 보내지 않습니다 — 서버가 MBTI J → PACKED, P → RELAXED로 정합니다 (D3-2).
 * 선호 지역·제외 조건은 이 설문에서 묻지 않아 빈 배열입니다.
 */
export function buildSubmission(questions: OnboardingQuestions, answers: SurveyAnswers): OnboardingSubmissionRequest {
  const mbti = questions.mbtiQuestions ?? [];
  return {
    questionVersion: questions.questionVersion,
    travelStyles: Object.fromEntries(questions.travelStyles.map((q) => [String(q.number), answers.styles[String(q.number)] ?? q.neutralValue])),
    travelMotives: answers.motives.slice(0, questions.maxTravelMotives),
    likedRegions: [],
    excludeTags: [],
    ...(mbti.length ? { mbtiAnswers: Object.fromEntries(mbti.map((q) => [String(q.number), answers.mbti[String(q.number)]])) } : {}),
  };
}
