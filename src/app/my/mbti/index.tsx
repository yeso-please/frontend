import { MbtiSurveyFlow } from "@/features/mbti";

// 여행 MBTI 검사 S1(질문 12개) → S2(경험 태그·제외 조건) → S3(분석). 결과는 /my/mbti/result 로 교체 이동합니다.
export default function MbtiSurveyScreen() {
  return <MbtiSurveyFlow />;
}
