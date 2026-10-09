// TanStack Query 키. 같은 데이터를 여러 화면이 쓰므로 한 곳에서 관리합니다.
export const queryKeys = {
  me: ["me"] as const,
  onboardingQuestions: ["onboarding", "questions"] as const,
  myOnboarding: ["onboarding", "me"] as const,
  regions: (days?: number, density?: string) => ["regions", days ?? "all", density ?? "default"] as const,
  regionCard: (sigCd: string) => ["regions", sigCd, "card"] as const,
  trips: (period?: string) => ["trips", period ?? "all"] as const,
  tripContext: (tripId: number) => ["trips", tripId, "context"] as const,
  participants: (tripId: number) => ["trips", tripId, "participants"] as const,
  friendInvites: (tripId: number) => ["trips", tripId, "friend-invites"] as const,
  unavailableDates: (from: string, to: string) => ["trips", "unavailable", from, to] as const,
  friends: ["friends"] as const,
};
