import { File } from "expo-file-system";

import { api } from "./client";
import type {
  Alternatives,
  AttractionCategory,
  AttractionDetail,
  CourseFirstLeg,
  AttractionPins,
  AuthResponse,
  ContextCheck,
  ContextCheckRequest,
  Course,
  CourseRoutes,
  CreateTripRequest,
  DateRange,
  DecideRegionRequest,
  DecideRegionResponse,
  Diary,
  DiaryLinkSummary,
  DiaryPhoto,
  DiaryUpdate,
  DrawRequest,
  DrawResult,
  Friend,
  FriendLinkPreview,
  FriendInvite,
  FriendLinkSummary,
  GenerateCourseRequest,
  InvitePreview,
  IssuedLink,
  LinkSummary,
  Me,
  MyOnboarding,
  OnboardingQuestions,
  OnboardingSubmission,
  OnboardingSubmissionRequest,
  Participant,
  Preferences,
  Presence,
  ReceivedInvite,
  RegionCard,
  RegionList,
  RegionMatch,
  RestaurantRecommendations,
  RestaurantSearch,
  ScheduleDensity,
  ScheduleOperation,
  SentFriendInvite,
  TasteMode,
  Transport,
  TravelMapPin,
  TripContext,
  TripSummary,
} from "./types";

export const authApi = {
  signup: (body: { email: string; password: string; nickname: string }) => api.post<AuthResponse>("/auth/signup", body, { auth: false }),
  login: (body: { email: string; password: string }) => api.post<AuthResponse>("/auth/login", body, { auth: false }),
  /** 카카오 인가 코드로 가입·로그인 (redirectUri는 인가 요청에 쓴 값과 같아야 합니다) */
  kakao: (body: { code: string; redirectUri: string }) => api.post<AuthResponse>("/auth/kakao", body, { auth: false }),
  logout: () => api.post<void>("/auth/logout", undefined, { auth: false }),
  me: () => api.get<Me>("/users/me"),
};

export const onboardingApi = {
  questions: () => api.get<OnboardingQuestions>("/onboarding/questions", { auth: false }),
  submit: (body: OnboardingSubmissionRequest) => api.post<OnboardingSubmission>("/onboarding/submissions", body),
  me: () => api.get<MyOnboarding>("/onboarding/me"),
};

export const preferencesApi = {
  get: () => api.get<Preferences>("/me/preferences"),
  update: (courseTasteMode: TasteMode) => api.patch<Preferences>("/me/preferences", { courseTasteMode }),
};

export const regionApi = {
  /** days를 빼면 추첨 가능 여부 없이 목록만 */
  list: (params?: { days?: number; scheduleDensity?: ScheduleDensity }) => api.get<RegionList>("/regions", { query: params }),
  card: (sigCd: string) => api.get<RegionCard>(`/regions/${sigCd}/card`),
  /** 7-5 지역 먼저 뽑기 — 저장하지 않습니다. 결과 regionSelection을 여행 만들기에 그대로 보냅니다 */
  draw: (body: DrawRequest) => api.post<DrawResult>("/regions/draw", body),
  /** 7-6 성향 맞춤 지역 문장 (닉네임은 화면이 앞에 붙입니다) */
  match: (sigCd: string) => api.get<RegionMatch>(`/regions/${sigCd}/match`),
};

export const attractionApi = {
  /** 7-3 지도 관광지 핀. bbox는 "minLng,minLat,maxLng,maxLat" (생략하면 지역 전체) */
  pins: (sigCd: string, params?: { bbox?: string; category?: AttractionCategory; cursor?: string; limit?: number }) =>
    api.get<AttractionPins>(`/regions/${sigCd}/attractions`, { query: params }),
  /** 7-4 관광지 상세 */
  detail: (attractionId: number) => api.get<AttractionDetail>(`/attractions/${attractionId}`),
};

export const tripApi = {
  unavailableDates: (from: string, to: string) => api.get<DateRange[]>("/trips/unavailable-dates", { query: { from, to } }),
  check: (body: ContextCheckRequest) => api.post<ContextCheck>("/trips/context/check", body),
  create: (body: CreateTripRequest) => api.post<TripContext>("/trips", body),
  list: (period?: "UPCOMING" | "PAST") => api.get<TripSummary[]>("/trips", { query: { period } }),
  context: (tripId: number) => api.get<TripContext>(`/trips/${tripId}/context`),
  updateContext: (tripId: number, body: { transport?: Transport; originLat?: number | null; originLng?: number | null; version: number }) =>
    api.patch<TripContext>(`/trips/${tripId}/context`, body),
  decideRegion: (tripId: number, body: DecideRegionRequest) => api.post<DecideRegionResponse>(`/trips/${tripId}/region`, body),
  participants: (tripId: number) => api.get<Participant[]>(`/trips/${tripId}/participants`),
  leave: (tripId: number) => api.delete(`/trips/${tripId}/participants/me`),
  /** 3-10 관리자만 */
  kick: (tripId: number, userId: number) => api.delete(`/trips/${tripId}/participants/${userId}`),
  /** 3-11 "보고 있어요" 신호 — 20초마다 */
  heartbeat: (tripId: number) => api.post<void>(`/trips/${tripId}/presence`),
  presence: (tripId: number) => api.get<Presence>(`/trips/${tripId}/presence`),
};

export const inviteApi = {
  issue: (tripId: number, expiresInDays = 7) => api.post<IssuedLink>(`/trips/${tripId}/invites`, { expiresInDays }),
  list: (tripId: number) => api.get<LinkSummary[]>(`/trips/${tripId}/invites`),
  /** 4-3 이후 수락을 막습니다. 이미 참여한 사람은 그대로 */
  revoke: (tripId: number, inviteId: number) => api.delete(`/trips/${tripId}/invites/${inviteId}`),
  preview: (token: string) => api.get<InvitePreview>(`/invites/${token}`, { auth: false }),
  /** 4-16 수락 전 코스 둘러보기 (로그인 불필요, 읽기 전용) */
  course: (token: string) => api.get<Course>(`/invites/${token}/course`, { auth: false }),
  accept: (token: string) => api.post<TripContext>(`/invites/${token}/accept`),
  inviteFriend: (tripId: number, friendUserId: number) => api.post<FriendInvite>(`/trips/${tripId}/friend-invites`, { friendUserId }),
  friendInvites: (tripId: number) => api.get<SentFriendInvite[]>(`/trips/${tripId}/friend-invites`),
  cancelFriendInvite: (tripId: number, inviteId: number) => api.delete(`/trips/${tripId}/friend-invites/${inviteId}`),
  /** 4-7 받은 초대 — 알림 벨 숫자 */
  received: () => api.get<ReceivedInvite[]>("/me/trip-invites"),
  acceptReceived: (id: number) => api.post<TripContext>(`/me/trip-invites/${id}/accept`),
  declineReceived: (id: number) => api.post<void>(`/me/trip-invites/${id}/decline`),
};

export const courseApi = {
  /** 5-1 최초 생성은 여행을 만든 사람만(COURSE_CREATOR_ONLY). AI 문장 때문에 수 초 걸립니다 */
  generate: (tripId: number, body: GenerateCourseRequest) => api.post<Course>(`/courses/${tripId}/generate`, body, { timeoutMs: 60000 }),
  get: (tripId: number) => api.get<Course>(`/courses/${tripId}`),
  /** 5-3 전부 적용되거나 전부 거부 */
  edit: (tripId: number, version: number, operations: ScheduleOperation[]) =>
    api.patch<Course>(`/courses/${tripId}/schedule`, { version, operations }),
  alternatives: (tripId: number, params: { itemId?: string; category?: AttractionCategory; limit?: number; q?: string }) =>
    api.get<Alternatives>(`/courses/${tripId}/alternatives`, { query: params }),
  restaurantRecommendations: (tripId: number, itemId: string, radius?: number) =>
    api.get<RestaurantRecommendations>(`/courses/${tripId}/restaurants/recommendations`, { query: { itemId, radius } }),
  restaurantSearch: (tripId: number, params: { itemId: string; query?: string; radius?: number; page?: number }) =>
    api.get<RestaurantSearch>(`/courses/${tripId}/restaurants/search`, { query: params }),
  /** 5-8 지금 위치 → 그날 첫 관광지 (참여자). 좌표는 query로만 보내고 저장하지 않습니다 */
  firstLeg: (tripId: number, dayIndex: number, lat: number, lng: number) =>
    api.get<CourseFirstLeg>(`/courses/${tripId}/first-leg`, { query: { dayIndex, lat, lng }, timeoutMs: 30000 }),
  /** 5-7 지도 경로 — 수단을 바꿔 부를 수 있습니다 */
  routes: (tripId: number, dayIndex: number, transport?: Transport) =>
    api.get<CourseRoutes>(`/courses/${tripId}/routes`, { query: { dayIndex, transport }, timeoutMs: 30000 }),
};

export const friendApi = {
  list: () => api.get<Friend[]>("/friends"),
  issueLink: (expiresInDays = 7) => api.post<IssuedLink>("/friend-links", { expiresInDays }),
  /** 2-7 공개 — 링크를 보낸 사람 닉네임 */
  previewLink: (token: string) => api.get<FriendLinkPreview>(`/friend-links/by-token/${token}`, { auth: false }),
  /** 2-8 수락하면 바로 친구가 됩니다 (이미 친구면 200, 같은 응답) */
  acceptLink: (token: string) => api.post<Friend>(`/friend-links/by-token/${token}/accept`),
  remove: (userId: number) => api.delete(`/friends/${userId}`),
  /** 2-5 만료·폐기된 링크도 포함, 최신순 */
  links: () => api.get<FriendLinkSummary[]>("/friend-links"),
  /** 2-6 이후 수락을 막습니다. 이미 맺은 친구는 그대로 */
  revokeLink: (id: number) => api.delete(`/friend-links/${id}`),
};

/** 4-9~4-13 코스 읽기 전용 공유 링크 — 참여하지 않은 사람에게 코스를 보여 줍니다 (참여자 이름은 감춰짐) */
export const courseShareApi = {
  issue: (tripId: number, expiresInDays = 7) => api.post<IssuedLink>(`/courses/${tripId}/share-links`, { expiresInDays }),
  list: (tripId: number) => api.get<LinkSummary[]>(`/courses/${tripId}/share-links`),
  /** 4-11 이미 열린 세션도 바로 무효 */
  revoke: (tripId: number, linkId: number) => api.delete(`/courses/${tripId}/share-links/${linkId}`),
  /** 4-12 공개 — token을 cookie로 바꾸고 303으로 4-13(공유 코스)을 돌려줍니다. fetch가 따라가 Course를 받습니다 */
  open: (token: string) => api.get<Course>(`/shared/courses/${token}`, { auth: false }),
};

/** 사진 한 장 — expo-image-picker 결과의 uri·mimeType·fileName */
export type UploadFile = { uri: string; name: string; type: string };

export const diaryApi = {
  /** 6-1 끝난 여행에 내 여행기(초안)를 만듭니다. 여행마다 하나 */
  create: (tripId: number, title?: string) => api.post<Diary>(`/courses/${tripId}/diary`, title ? { title } : undefined),
  get: (diaryId: number) => api.get<Diary>(`/diaries/${diaryId}`),
  /** 6-4 보낸 필드만 바꿉니다 */
  update: (diaryId: number, body: DiaryUpdate) => api.patch<Diary>(`/diaries/${diaryId}`, body),
  /** 6-2 JPEG·PNG·WebP, 장당 10MB, 여행기 전체 30장. 한 장이라도 실패하면 전부 저장하지 않습니다 */
  uploadPhotos: (diaryId: number, files: UploadFile[]) => {
    const form = new FormData();
    // SDK 57의 전역 fetch(expo/fetch)는 RN식 {uri, name, type} 파트를 보내지 못합니다 — expo-file-system의 File로 넣습니다.
    for (const f of files) form.append("files", new File(f.uri));
    return api.post<{ photos: DiaryPhoto[] }>(`/diaries/${diaryId}/photos`, form, { timeoutMs: 120000 });
  },
  deletePhoto: (diaryId: number, photoId: number) => api.delete(`/diaries/${diaryId}/photos/${photoId}`),
  /** 6-5 제목만 있으면 발행됩니다 (사진은 없어도 됨) */
  publish: (diaryId: number) => api.post<Diary>(`/diaries/${diaryId}/publish`),
  remove: (diaryId: number) => api.delete(`/diaries/${diaryId}`),
  /** 6-9 발행됐고 공개 범위가 LINK일 때만 */
  issueShareLink: (diaryId: number, expiresInDays = 7) => api.post<IssuedLink>(`/diaries/${diaryId}/share-links`, { expiresInDays }),
  shareLinks: (diaryId: number) => api.get<DiaryLinkSummary[]>(`/diaries/${diaryId}/share-links`),
  /** 6-10 이미 열린 세션도 바로 무효 */
  revokeShareLink: (diaryId: number, linkId: number) => api.delete(`/diaries/${diaryId}/share-links/${linkId}`),
};

export const travelMapApi = {
  /** 6-7 내 여행기 핀 (초안 포함) */
  mine: (range?: { from?: string; to?: string }) => api.get<TravelMapPin[]>("/me/travel-map", { query: range }),
  /** 6-8 친구의 발행된 FRIENDS 공개 여행기만 */
  friend: (userId: number) => api.get<TravelMapPin[]>(`/friends/${userId}/travel-map`),
};
