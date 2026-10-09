// docs/frontend-api-guide.md (백엔드 docs/api/ 기준)의 응답 모양. 필드가 바뀌면 백엔드 명세를 먼저 확인합니다.

export type ScheduleDensity = "RELAXED" | "PACKED";
export type Transport = "WALK" | "CAR" | "PUBLIC_TRANSIT";
export type RegionSelection = "RANDOM" | "CONDITIONAL" | "MANUAL";
export type TasteStatus = "READY" | "PENDING" | "FAILED";

// ── 인증 ──
export type User = { id: number; email: string; nickname: string; profileImage: string | null };
export type AuthResponse = {
  user: User;
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  onboardingCompleted: boolean;
};
export type Me = User & { onboardingCompleted: boolean };

// ── 온보딩 (aihub-traveler-v1) ──
export type TravelStyleQuestion = {
  number: number;
  leftPole: string;
  rightPole: string;
  minValue: number;
  maxValue: number;
  neutralValue: number;
  evidence: "OFFICIAL" | "INFERRED";
};
export type TravelMotive = { code: number; label: string };
export type OnboardingQuestions = {
  questionVersion: string;
  travelStyles: TravelStyleQuestion[];
  travelMotives: TravelMotive[];
  maxTravelMotives: number;
  maxLikedRegions: number;
  excludeTags: string[];
  scheduleDensityOptions: ScheduleDensity[];
};
export type OnboardingSubmissionRequest = {
  questionVersion: string;
  travelStyles: Record<string, number>;
  travelMotives: number[];
  likedRegions: string[];
  scheduleDensity: ScheduleDensity;
  excludeTags: string[];
};
export type OnboardingSubmission = OnboardingSubmissionRequest & {
  submissionId: string;
  profileText: string;
  tasteStatus: TasteStatus;
  onboardingCompleted: boolean;
  createdAt: string;
};
export type MyOnboarding = { onboardingCompleted: boolean; submission: OnboardingSubmission | null };

// ── 지역 ──
export type Region = {
  sigCd: string;
  province: string;
  city: string;
  centerLat: number;
  centerLng: number;
  /** days 없이 조회하면 null */
  drawEligible: boolean | null;
  ineligibleReasons: string[] | null;
};
export type RegionList = {
  days: number | null;
  scheduleDensity: ScheduleDensity | null;
  eligibleCount: number | null;
  regions: Region[];
};
export type RegionCard = {
  sigCd: string;
  province: string;
  city: string;
  title: string;
  introduction: string[];
  heroImage: { url: string; sourceName: string; sourceUrl: string; license: string | null } | null;
  characteristics: string[];
  historyHighlights: string[];
  landmarks: { attractionId: number; name: string; thumbnailUrl: string | null }[];
  sources: { name: string; url: string }[];
  updatedAt: string | null;
};

// ── 여행 ──
export type TripContext = {
  id: number;
  startDate: string;
  endDate: string;
  nights: number;
  transport: Transport;
  originLat: number | null;
  originLng: number | null;
  regionSigCd: string | null;
  regionSelection: RegionSelection | null;
  scheduleDensity: ScheduleDensity | null;
  hasCourse: boolean;
  version: number;
};
export type DateRange = { tripId: number; startDate: string; endDate: string };
export type TripConflict = DateRange & { title: string };
export type ContextCheck = { available: boolean; endDate: string; conflicts: TripConflict[]; eligibleRegionCount: number };
export type CreateTripRequest = { startDate: string; nights: number; transport: Transport; originLat?: number; originLng?: number };
export type TripSummary = {
  tripId: number;
  title: string;
  regionSigCd: string | null;
  regionName: string | null;
  startDate: string;
  endDate: string;
  nights: number;
  participants: { userId: number; nickname: string }[];
  hasCourse: boolean;
  myDiaryId: number | null;
  updatedAt: string;
};
export type DecideRegionRequest = {
  mode: RegionSelection;
  conditions?: ("DISTANCE" | "MY_TASTE")[];
  sigCd?: string | null;
  scheduleDensity?: ScheduleDensity;
  replaceCourse?: boolean;
  version: number;
};
export type DecideRegionResponse = {
  tripId: number;
  regionSigCd: string;
  province: string;
  city: string;
  regionSelection: RegionSelection;
  scheduleDensity: ScheduleDensity;
  appliedConditions: string[];
  ignoredConditions: { condition: string; reason: string }[];
  candidateCount: number;
  warnings: string[];
  version: number;
};
export type Participant = { userId: number; nickname: string; isCreator: boolean; joinedAt: string };

// ── 초대·친구 ──
export type IssuedLink = { id: number; token: string; expiresAt: string; createdAt: string };
export type LinkSummary = { id: number; expiresAt: string; revoked: boolean; createdBy: { userId: number; nickname: string }; createdAt: string };
export type InvitePreview = {
  valid: boolean;
  title: string;
  startDate: string;
  endDate: string;
  regionName: string | null;
  inviterNickname: string;
  participantCount: number;
};
export type FriendInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
export type FriendInvite = {
  id: number;
  tripId: number;
  invitee: { userId: number; nickname: string };
  status: FriendInviteStatus;
  createdAt: string;
};
export type Friend = { userId: number; nickname: string; since: string };

// ── 오류 ──
export type ApiErrorBody = {
  timestamp?: string;
  status: number;
  code: string;
  message: string;
  path?: string;
  fieldErrors?: { field: string; message: string }[];
  details?: Record<string, unknown>;
};
