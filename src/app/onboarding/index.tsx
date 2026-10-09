import { OnboardingFlow } from "@/features/onboarding";

// 가입 직후 취향 온보딩. 끝나면 루트 가드가 탭 화면으로 바꿉니다.
export default function OnboardingScreen() {
  return <OnboardingFlow mode="first" />;
}
