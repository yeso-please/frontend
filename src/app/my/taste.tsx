import { OnboardingFlow } from "@/features/onboarding";

// MY → "여행 취향 다시 설정". 온보딩과 같은 설문을 다시 제출합니다 (새 submission이 최신 취향이 됩니다).
export default function TasteRetakeScreen() {
  return <OnboardingFlow mode="retake" />;
}
