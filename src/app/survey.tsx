import { OnboardingFlow } from "@/features/onboarding";

// 홈·MY → 성향검사 다시하기. 첫 설문과 같은 한 페이지 설문을 다시 제출합니다 (새 제출이 최신 취향이 됩니다).
export default function SurveyScreen() {
  return <OnboardingFlow mode="retake" />;
}
