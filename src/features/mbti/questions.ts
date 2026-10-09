import type { MbtiType } from "@/store/mbti";

// 여행 MBTI 12문항과 글자 매핑.
// 출처: backend docs/api/profile.md "부록. 구형 설문 기록 (demo-mbti-v1, legacy)"
//      backend src/main/java/com/yeso/backend/profile/domain/OnboardingQuestionBank.java QUESTIONS
// 문구는 원문 그대로입니다 (12번 두 번째 선택지는 문서의 "저_장" 대신 Java 상수의 "저장"을 따릅니다).
// 이 결과는 앱 안에서만 계산하며 서버(demo-mbti-v1)로 절대 제출하지 않습니다.

export type MbtiAxis = "EI" | "SN" | "TF" | "JP";
export type MbtiLetter = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
export type MbtiChoice = { text: string; letter: MbtiLetter };
export type MbtiQuestion = { number: number; axis: MbtiAxis; text: string; choices: [MbtiChoice, MbtiChoice] };

const q = (number: number, axis: MbtiAxis, text: string, first: [string, MbtiLetter], second: [string, MbtiLetter]): MbtiQuestion => ({
  number,
  axis,
  text,
  choices: [
    { text: first[0], letter: first[1] },
    { text: second[0], letter: second[1] },
  ],
});

export const MBTI_QUESTIONS: MbtiQuestion[] = [
  q(1, "JP", "여행을 떠날 때 계획은", ["내가 걷는 길이 곧 여행코스", "P"], ["계획은 필수", "J"]),
  q(2, "JP", "여행 경비는", ["당장 국제거지만 안되면 되지!", "P"], ["걸어다니는 계산기로 변신", "J"]),
  q(3, "JP", "여행을 다녀온 후", ["홈스윗홈.. 침대로 점프!", "P"], ["캐리어를 열고 물건을 정리한다", "J"]),
  q(4, "JP", "여행지에서 식사할 때", ["유~명한 맛집을 작정하고 노리는 헌터", "J"], ["처음 본 순간 사랑에 빠진 길거리 가게", "P"]),
  q(5, "SN", "여행지에서 길을 잃었을 때", ["왔던 길로 돌아가는 헨젤과 그레텔st.", "S"], ["자꾸 걸어 나가면 길이 있겠지, 지구는 둥그니까", "N"]),
  q(6, "SN", "화려한 건축물을 보며 드는 생각은", ["\"어떤 방법으로 지었을까?\" 고민한다", "S"], ["\"와 멋있다...\" 감탄한다", "N"]),
  q(7, "TF", "아침에 늦잠 잔 친구에게", ["\"여행이 역시 피곤하지.\"", "F"], ["\"내일은 시간 지키자.\"", "T"]),
  q(8, "TF", "친구에게 차 사고가 났다고 전화 왔을 때 나의 대답은", ["\"괜찮아? ㅠㅠ 다친 데는 없어?\"", "F"], ["\"보험 들었어?\"", "T"]),
  q(9, "TF", "친구가 쓸데없는 기념품을 살 때", ["\"그래 니가 행복하다면...\"", "F"], ["\"그거 결국 쓰레기 된다\"", "T"]),
  q(10, "EI", "나는 여행지를 선택할 때 주로", ["사람이 많은 도시로", "E"], ["나무가 많은 자연으로", "I"]),
  q(11, "EI", "숙소를 구할 때", ["저녁에 바비큐 파티를 여는 곳", "E"], ["조용하고 아늑한 곳", "I"]),
  q(12, "EI", "여행지에 대한 감상을", ["말로 내뱉어야 직성이 풀린다", "E"], ["내 마음 속에 저장, 마음에 담고 느낀다", "I"]),
];

/** 축별 [앞 글자, 뒤 글자]. 최종 코드는 EI + SN + TF + JP 순서 */
const AXES: [MbtiAxis, MbtiLetter, MbtiLetter][] = [
  ["EI", "E", "I"],
  ["SN", "S", "N"],
  ["TF", "T", "F"],
  ["JP", "J", "P"],
];

/**
 * 축별로 고른 글자 수를 비교해 많은 쪽을 고릅니다.
 * 동점(SN 1:1, JP 2:2)이면 백엔드 규칙과 같이 뒤 글자 I/N/F/P를 고릅니다.
 * @param answers 문항 순서대로 고른 선택지 index (0 또는 1)
 */
export function computeMbti(answers: readonly (0 | 1)[]): MbtiType {
  const counts: Partial<Record<MbtiLetter, number>> = {};
  MBTI_QUESTIONS.forEach((question, i) => {
    const choice = answers[i];
    if (choice === undefined) return;
    const letter = question.choices[choice].letter;
    counts[letter] = (counts[letter] ?? 0) + 1;
  });
  return AXES.map(([, front, back]) => ((counts[front] ?? 0) > (counts[back] ?? 0) ? front : back)).join("") as MbtiType;
}
