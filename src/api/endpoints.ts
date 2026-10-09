import { api } from "./client";
import type {
  AuthResponse,
  ContextCheck,
  CreateTripRequest,
  DateRange,
  DecideRegionRequest,
  DecideRegionResponse,
  Friend,
  FriendInvite,
  InvitePreview,
  IssuedLink,
  LinkSummary,
  Me,
  MyOnboarding,
  OnboardingQuestions,
  OnboardingSubmission,
  OnboardingSubmissionRequest,
  Participant,
  RegionCard,
  RegionList,
  ScheduleDensity,
  TripContext,
  TripSummary,
} from "./types";

export const authApi = {
  signup: (body: { email: string; password: string; nickname: string }) => api.post<AuthResponse>("/auth/signup", body, { auth: false }),
  login: (body: { email: string; password: string }) => api.post<AuthResponse>("/auth/login", body, { auth: false }),
  logout: () => api.post<void>("/auth/logout", undefined, { auth: false }),
  me: () => api.get<Me>("/users/me"),
};

export const onboardingApi = {
  questions: () => api.get<OnboardingQuestions>("/onboarding/questions", { auth: false }),
  submit: (body: OnboardingSubmissionRequest) => api.post<OnboardingSubmission>("/onboarding/submissions", body),
  me: () => api.get<MyOnboarding>("/onboarding/me"),
};

export const regionApi = {
  /** days를 빼면 추첨 가능 여부 없이 목록만 (온보딩용) */
  list: (params?: { days?: number; scheduleDensity?: ScheduleDensity }) => api.get<RegionList>("/regions", { query: params }),
  card: (sigCd: string) => api.get<RegionCard>(`/regions/${sigCd}/card`),
};

export const tripApi = {
  unavailableDates: (from: string, to: string) => api.get<DateRange[]>("/trips/unavailable-dates", { query: { from, to } }),
  check: (body: { startDate: string; nights: number }) => api.post<ContextCheck>("/trips/context/check", body),
  create: (body: CreateTripRequest) => api.post<TripContext>("/trips", body),
  list: (period?: "UPCOMING" | "PAST") => api.get<TripSummary[]>("/trips", { query: { period } }),
  context: (tripId: number) => api.get<TripContext>(`/trips/${tripId}/context`),
  decideRegion: (tripId: number, body: DecideRegionRequest) => api.post<DecideRegionResponse>(`/trips/${tripId}/region`, body),
  participants: (tripId: number) => api.get<Participant[]>(`/trips/${tripId}/participants`),
  leave: (tripId: number) => api.delete(`/trips/${tripId}/participants/me`),
};

export const inviteApi = {
  issue: (tripId: number, expiresInDays = 7) => api.post<IssuedLink>(`/trips/${tripId}/invites`, { expiresInDays }),
  list: (tripId: number) => api.get<LinkSummary[]>(`/trips/${tripId}/invites`),
  preview: (token: string) => api.get<InvitePreview>(`/invites/${token}`, { auth: false }),
  accept: (token: string) => api.post<TripContext>(`/invites/${token}/accept`),
  inviteFriend: (tripId: number, friendUserId: number) => api.post<FriendInvite>(`/trips/${tripId}/friend-invites`, { friendUserId }),
  friendInvites: (tripId: number) => api.get<FriendInvite[]>(`/trips/${tripId}/friend-invites`),
  cancelFriendInvite: (tripId: number, inviteId: number) => api.delete(`/trips/${tripId}/friend-invites/${inviteId}`),
};

export const friendApi = {
  list: () => api.get<Friend[]>("/friends"),
  issueLink: (expiresInDays = 7) => api.post<IssuedLink>("/friend-links", { expiresInDays }),
};
