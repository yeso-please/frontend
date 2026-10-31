// 백엔드 docs/api/ (auth·profile·trip·attraction) 기준 응답 모양. 필드가 바뀌면 백엔드 명세를 먼저 확인합니다.
// 화면별로 어떤 API를 부르는지는 백엔드 docs/frontend-guide.md (확정 디자인 489:4621) 를 따릅니다.

export type ScheduleDensity = "RELAXED" | "PACKED";
export type Transport = "WALK" | "CAR" | "PUBLIC_TRANSIT";
export type RegionSelection = "RANDOM" | "CONDITIONAL" | "MANUAL";
export type DrawCondition = "DISTANCE" | "MY_TASTE";
export type TasteStatus = "READY" | "PENDING" | "FAILED";
export type TasteMode = "TASTE" | "RANDOM";
export type TextSource = "RULE" | "LLM";
export type UserRef = { userId: number; nickname: string };

// ── 인증 ──
/** 카카오로 가입한 소셜 전용 회원은 email이 null입니다 */
export type User = { id: number; email: string | null; nickname: string; profileImage: string | null };
export type LoginMethod = "EMAIL" | "KAKAO";
export type AuthResponse = {
  user: User;
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  onboardingCompleted: boolean;
};
export type Me = User & { onboardingCompleted: boolean; loginMethods: LoginMethod[] };

// ── 온보딩 (aihub-traveler-v2: AI Hub 설문 + 여행 MBTI 12문항) ──
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
/** 선택지가 어느 글자(E/I 등)로 이어지는지는 서버만 압니다 */
export type MbtiQuestion = { number: number; question: string; choices: { choice: 1 | 2; label: string }[] };
export type OnboardingQuestions = {
  questionVersion: string;
  travelStyles: TravelStyleQuestion[];
  travelMotives: TravelMotive[];
  maxTravelMotives: number;
  maxLikedRegions: number;
  excludeTags: string[];
  scheduleDensityOptions: ScheduleDensity[];
  /** v2부터. v1 서버면 없을 수 있습니다 */
  mbtiQuestions?: MbtiQuestion[];
};
export type OnboardingSubmissionRequest = {
  questionVersion: string;
  travelStyles: Record<string, number>;
  travelMotives: number[];
  likedRegions: string[];
  /** v2는 보내지 않습니다 — 서버가 MBTI J → PACKED, P → RELAXED로 정합니다 (D3-2) */
  scheduleDensity?: ScheduleDensity;
  excludeTags: string[];
  /** v2면 필수: 키 "1"~"12", 값 1 또는 2 */
  mbtiAnswers?: Record<string, 1 | 2>;
};
// 응답에는 excludeTags·mbtiAnswers가 없습니다 (백엔드 OnboardingSubmissionResponse 기준).
export type OnboardingSubmission = Omit<OnboardingSubmissionRequest, "excludeTags" | "mbtiAnswers" | "scheduleDensity"> & {
  scheduleDensity: ScheduleDensity;
  excludeTags?: string[];
  /** v2면 서버가 계산한 4글자 MBTI, v1이면 null. 표시용이며 추천에는 쓰이지 않습니다 */
  mbtiCode: string | null;
  submissionId: string;
  profileText: string;
  tasteStatus: TasteStatus;
  onboardingCompleted: boolean;
  createdAt: string;
};
export type MyOnboarding = { onboardingCompleted: boolean; submission: OnboardingSubmission | null };
export type Preferences = { courseTasteMode: TasteMode };

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
export type HeroImage = {
  url: string;
  sourceName: string | null;
  sourceUrl: string | null;
  license: string | null;
  /** 지역 대표 사진(공공누리)일 때 촬영자 — 출처 표시에 함께 씁니다 */
  photographer: string | null;
  /** 대표 관광지 사진으로 채웠을 때 그 관광지 */
  attractionId: number | null;
};
export type Landmark = { attractionId: number; name: string; thumbnailUrl: string | null; oneLine: string | null };
export type RegionCard = {
  sigCd: string;
  province: string;
  city: string;
  title: string;
  /** 사람이 승인한 한 줄 소개(30자 이내). 없으면 null */
  tagline: string | null;
  /** 승인된 태그 0~4개 ("#" 없이) */
  tags: string[];
  introduction: string[];
  heroImage: HeroImage | null;
  characteristics: string[];
  historyHighlights: string[];
  /** B4 "만나볼 순간" — 최대 3곳 */
  landmarks: Landmark[];
  sources: { name: string; url: string }[];
  updatedAt: string | null;
};
export type DrawRequest = {
  mode: "RANDOM" | "CONDITIONAL";
  conditions?: DrawCondition[];
  originLat?: number;
  originLng?: number;
  scheduleDensity?: ScheduleDensity | null;
};
export type DrawResult = {
  sigCd: string;
  province: string;
  city: string;
  lat: number;
  lng: number;
  regionSelection: "RANDOM" | "CONDITIONAL";
  scheduleDensity: ScheduleDensity;
  /** 이 지역·밀도로 코스를 만들 수 있는 최대 박수(0~6) */
  maxNights: number;
  appliedConditions: DrawCondition[];
  ignoredConditions: { condition: DrawCondition; reason: string }[];
  candidateCount: number;
  warnings: string[];
};
/** 7-6 성향 맞춤 지역 문장. 설문 v1·설문 전이면 mbtiCode·personaName·text가 null */
export type RegionMatch = {
  sigCd: string;
  mbtiCode: string | null;
  personaName: string | null;
  text: string | null;
  textSource: TextSource | null;
  aiGenerated: boolean;
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
  retroactive: boolean;
  version: number;
};
export type DateRange = { tripId: number; startDate: string; endDate: string };
export type TripConflict = DateRange & { title: string };
export type ContextCheckRequest = { startDate: string; nights: number; sigCd?: string; scheduleDensity?: ScheduleDensity | null };
export type ContextCheck = {
  available: boolean;
  endDate: string;
  conflicts: TripConflict[];
  eligibleRegionCount: number;
  /** 요청에 sigCd가 없으면 null. false면 이 기간엔 그 지역으로 코스를 만들 수 없습니다 */
  regionEligible: boolean | null;
};
/** transport는 보내지 않으면 서버 기본 CAR (D2) */
export type CreateTripRequest = {
  startDate: string;
  nights: number;
  regionSigCd?: string;
  regionSelection?: RegionSelection;
  transport?: Transport;
  originLat?: number;
  originLng?: number;
  scheduleDensity?: ScheduleDensity;
};
export type TripSummary = {
  tripId: number;
  /** 코스 제목, 없으면 서버 대체 제목 ("10월 10일부터 2박 3일 여행") */
  title: string;
  regionSigCd: string | null;
  regionName: string | null;
  startDate: string;
  endDate: string;
  nights: number;
  participants: UserRef[];
  hasCourse: boolean;
  retroactive: boolean;
  myDiaryId: number | null;
  updatedAt: string;
};
export type DecideRegionRequest = {
  mode: RegionSelection;
  conditions?: DrawCondition[];
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
export type Participant = {
  userId: number;
  nickname: string;
  isCreator: boolean;
  /** 참여자를 내보낼 수 있는 사람(3-10) — 만든 사람, 나갔으면 가장 먼저 들어온 참여자 */
  isManager: boolean;
  joinedAt: string;
};
export type Presence = {
  heartbeatSeconds: number;
  activeWindowSeconds: number;
  /** 최근 신호를 보낸 참여자(나 포함) */
  participants: (UserRef & { lastSeenAt: string })[];
};

// ── 초대·친구 ──
export type IssuedLink = { id: number; token: string; expiresAt: string; createdAt: string };
export type LinkSummary = { id: number; expiresAt: string; revoked: boolean; createdBy: UserRef; createdAt: string };
/** 2-5 내 친구 초대 링크 — acceptedCount는 이 링크로 새로 친구가 된 수 */
export type FriendLinkSummary = { id: number; expiresAt: string; revoked: boolean; acceptedCount: number; createdAt: string };
/** 6-9 여행기 공유 링크 목록 (token 원문 없음) */
export type DiaryLinkSummary = { id: number; expiresAt: string; revoked: boolean; createdAt: string };
export type InvitePreview = {
  valid: boolean;
  title: string;
  startDate: string;
  endDate: string;
  regionSigCd: string | null;
  regionName: string | null;
  heroImageUrl: string | null;
  inviterNickname: string;
  participantCount: number;
  participants: { nickname: string }[];
  hasCourse: boolean;
};
export type FriendInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
export type FriendInvite = {
  id: number;
  tripId: number;
  invitee: UserRef;
  status: FriendInviteStatus;
  createdAt: string;
};
/** 4-14 보낸 친구 초대 (누가 보냈든 참여자 모두에게 같은 목록) */
export type SentFriendInvite = {
  id: number;
  invitee: UserRef;
  inviter: UserRef;
  status: FriendInviteStatus;
  createdAt: string;
};
/** 4-7 받은 초대 — 알림 벨 숫자 = 배열 길이 (D15) */
export type ReceivedInvite = {
  id: number;
  trip: {
    tripId: number;
    title: string;
    startDate: string;
    endDate: string;
    regionName: string | null;
    heroImageUrl: string | null;
    participants: { nickname: string }[];
  };
  inviter: UserRef;
  /** true면 수락 버튼을 비활성화합니다 */
  dateConflict: boolean;
  createdAt: string;
};
export type Friend = { userId: number; nickname: string; since: string };
/** 2-7 친구 초대 링크 미리보기 (로그인 전에도 누가 보낸 링크인지) */
export type FriendLinkPreview = { valid: boolean; inviterNickname: string };

// ── 코스 ──
export type AttractionCategory = "NATURE" | "HISTORY_CULTURE" | "ACTIVITY" | "WALK_REST" | "ETC";
/** 7-3 지도 관광지 핀 — 추천 불가 장소도 옵니다(recommendable false: 흐리게, 코스에 못 넣음) */
export type AttractionPin = { attractionId: number; name: string; thumbnailUrl: string | null; category: AttractionCategory; lat: number; lng: number; recommendable: boolean };
export type AttractionPins = { items: AttractionPin[]; nextCursor: string | null };
/** 7-4 관광지 상세. description은 원천 그대로(생성 문장 아님), oneLine은 사람이 승인한 한 줄 */
export type AttractionDetail = {
  attractionId: number;
  regionSigCd: string;
  name: string;
  category: AttractionCategory;
  address: string | null;
  lat: number;
  lng: number;
  description: string | null;
  images: { url: string; sourceName: string | null; license: string | null }[];
  useTime: string | null;
  restDate: string | null;
  estimatedDurationMinutes: number;
  estimated: boolean;
  recommendable: boolean;
  notRecommendableReasons: ("MISSING_DESCRIPTION" | "MISSING_IMAGE" | "MISSING_COORDINATE" | "QUALITY_ISSUE")[];
  sources: { name: string; contentId?: string | null; fetchedAt?: string | null }[];
  oneLine: string | null;
  tags: string[];
  summaryBasis: "SOURCE_SUMMARY" | "NAME_CATEGORY" | null;
};
export type RouteSource = "ROAD" | "ROUTE" | "STRAIGHT";
/** 앞 지점에서 이 지점까지 세 수단의 이동 (D5). 그날 첫 지점·식당 미정 식사는 null */
export type TravelLeg = {
  meters: number;
  walkMinutes: number;
  carMinutes: number;
  transitMinutes: number;
  carSource: RouteSource;
  walkSource: RouteSource;
  transitSource: RouteSource;
  transitTransfers: number | null;
  transitFare: number | null;
  estimated: boolean;
};
export type ChangeOrigin = "BASE" | "ADDED" | "REPLACED";
export type ItemChange = {
  origin: ChangeOrigin;
  by: UserRef | null;
  replacedFrom: { attractionId: number; name: string } | null;
  note: string | null;
  changedAt: string | null;
};
export type RestaurantProvider = "TOUR_API" | "FARM_RESTAURANT" | "MODEL_RESTAURANT" | "GOOD_PRICE" | "KAKAO";
export type RestaurantSnapshot = {
  provider: RestaurantProvider;
  externalId: string;
  name: string;
  category: string | null;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  placeUrl: string | null;
  imageUrl: string | null;
  representativeMenu: string | null;
  evidenceLabels: string[];
  sources: { name: string; url: string | null; fetchedAt?: string | null }[];
};
type ItemBase = {
  itemId: string;
  durationMinutes: number;
  travelFromPreviousMinutes: number | null;
  travelFromPreviousMeters: number | null;
  travelFromPrevious: TravelLeg | null;
};
export type AttractionItem = ItemBase & {
  type: "ATTRACTION";
  attractionId: number;
  name: string;
  category: AttractionCategory;
  thumbnailUrl: string | null;
  address: string | null;
  lat: number;
  lng: number;
  estimated: boolean;
  source: "RECOMMEND" | "MANUAL";
  reason: string | null;
  reasonSource: TextSource | null;
  /** 취향 기준 회원 본인에게만 보이는 AI 이유 */
  personalReason: string | null;
  oneLine: string | null;
  summaryBasis: "SOURCE_SUMMARY" | "NAME_CATEGORY" | null;
  change: ItemChange;
};
export type MealItem = ItemBase & {
  type: "MEAL";
  meal: "LUNCH" | "DINNER";
  /** null이면 "미정" */
  restaurant: RestaurantSnapshot | null;
};
export type CourseItem = AttractionItem | MealItem;
export type CourseDay = { dayIndex: number; date: string; items: CourseItem[] };
export type ChangeKind = "ADDED" | "REPLACED" | "REMOVED" | "RESTORED";
export type CourseChanges = {
  baselineAt: string;
  days: { dayIndex: number; added: number; replaced: number; removed: number }[];
  removed: {
    removalId: number;
    attractionId: number;
    name: string;
    dayIndex: number;
    origin: ChangeOrigin;
    removedBy: UserRef | null;
    note: string | null;
    removedAt: string;
  }[];
  latest: {
    type: ChangeKind;
    dayIndex: number;
    attractionName: string;
    replacedFromName: string | null;
    by: UserRef | null;
    note: string | null;
    at: string;
  } | null;
};
export type CourseWarning = { code: string; dayIndex: number | null; itemId: string | null };
export type RecommendationMode = "PERSONALIZED" | "TOUR_OFFICIAL" | "RULE_BASED" | "RANDOM";
export type Course = {
  tripId: number;
  version: number;
  myRole: "PARTICIPANT" | "VIEWER";
  regionSigCd: string | null;
  regionName: string | null;
  startDate: string;
  endDate: string;
  scheduleDensity: ScheduleDensity | null;
  title: string | null;
  titleSource: TextSource | null;
  intro: string | null;
  introSource: TextSource | null;
  aiGenerated: boolean;
  recommendationMode: RecommendationMode | null;
  tasteBasis: UserRef | null;
  days: CourseDay[];
  warnings: CourseWarning[];
  changes: CourseChanges | null;
  updatedBy: UserRef | null;
  updatedAt: string | null;
};
export type GenerateCourseRequest = { version: number; scheduleDensity?: ScheduleDensity; tasteMode?: TasteMode };
export type ScheduleOperation =
  | { op: "ADD"; dayIndex: number; position?: number; attractionId: number }
  | { op: "REPLACE"; itemId: string; attractionId: number; note?: string }
  | { op: "MOVE"; itemId: string; dayIndex: number; position: number }
  /** 관광지는 제외 기록(changes.removed)에 남고, 식사(m-…)는 식사 칸·식당을 함께 지웁니다(식사에 note를 보내면 400) */
  | { op: "REMOVE"; itemId: string; note?: string }
  | { op: "RESTORE"; removalId: number; dayIndex?: number; position?: number }
  | { op: "SET_RESTAURANT"; itemId: string; selectionToken: string }
  | { op: "CLEAR_RESTAURANT"; itemId: string }
  /** 뺀 점심·저녁을 다시 넣습니다 (날마다 끼니별 하나). position 생략 = 그날 맨 뒤, 식당은 미정 */
  | { op: "ADD_MEAL"; dayIndex: number; meal: MealItem["meal"]; position?: number };
export type AlternativeItem = {
  attractionId: number;
  name: string;
  category: AttractionCategory;
  thumbnailUrl: string | null;
  lat: number;
  lng: number;
  estimatedDurationMinutes: number;
  travelFromPreviousMinutes: number | null;
  reason: string | null;
};
export type Alternatives = {
  itemId: string | null;
  groups: { category: AttractionCategory; label: string; items: AlternativeItem[] }[];
};
export type RestaurantOrigin = { type: "PREVIOUS_ATTRACTION" | "REGION_CENTER"; attractionId?: number | null; lat: number; lng: number };
/** reasons: 5-5 추천만 최대 2개 ("다음 장소 가는 길이에요 · 200m만 돌아가요"). 5-6 카카오 검색에는 없습니다 */
export type RestaurantCandidate = RestaurantSnapshot & { selectionToken: string; distanceMeters: number; reasons?: string[] };
export type RestaurantRecommendations = {
  itemId: string;
  origin: RestaurantOrigin;
  regionFoodThemes: { name: string; sources: { name: string; url: string }[] }[];
  sections: { source: RestaurantProvider; label: string; items: RestaurantCandidate[] }[];
};
export type RestaurantSearch = { itemId: string; origin: RestaurantOrigin; page: number; isEnd: boolean; items: RestaurantCandidate[] };
/** 5-8 지금 위치 → 그날 첫 관광지. source가 STRAIGHT면 실패·시간 초과로 직선 추정, walk는 직선 10km 넘으면 null */
export type FirstLegMode = {
  source: "ROAD" | "WALK" | "TRANSIT" | "STRAIGHT";
  distanceMeters: number;
  durationMinutes: number;
  transfers: number | null;
  fare: number | null;
};
export type CourseFirstLeg = {
  tripId: number;
  dayIndex: number;
  itemId: string;
  attractionId: number;
  name: string;
  lat: number;
  lng: number;
  straightMeters: number;
  car: FirstLegMode;
  walk: FirstLegMode | null;
  transit: FirstLegMode;
};
export type RouteLeg = {
  fromItemId: string;
  toItemId: string;
  source: "ROAD" | "WALK" | "TRANSIT" | "STRAIGHT";
  distanceMeters: number;
  durationMinutes: number;
  /** [위도, 경도] 점 목록 */
  path: [number, number][];
  transfers: number | null;
  fare: number | null;
};
export type CourseRoutes = { tripId: number; version: number; dayIndex: number; transport: Transport; legs: RouteLeg[] };

// ── 여행기·여행 지도 (6장) ──
export type DiaryStatus = "DRAFT" | "PUBLISHED";
/** PRIVATE 나만 · FRIENDS 수락된 친구 · LINK 공유 링크 소지자 */
export type DiaryVisibility = "PRIVATE" | "FRIENDS" | "LINK";
/** 남에게 보일 사진 위치: EXACT 그대로 · CITY 지역 중심 · HIDDEN 숨김 (작성자에게는 항상 원래 위치) */
export type LocationPrecision = "EXACT" | "CITY" | "HIDDEN";
export type DiaryPhoto = {
  photoId: number;
  url: string;
  thumbnailUrl: string;
  takenAt: string | null;
  lat: number | null;
  lng: number | null;
  order: number;
};
export type Diary = {
  diaryId: number;
  tripId: number;
  status: DiaryStatus;
  title: string;
  body: string | null;
  courseTitle: string | null;
  regionSigCd: string | null;
  visitedFrom: string;
  visitedTo: string;
  visibility: DiaryVisibility;
  locationPrecision: LocationPrecision;
  satisfaction: number | null;
  experienceTags: string[];
  /** 작성자에게만 옵니다 */
  includeInTasteProfile?: boolean;
  coverPhotoId: number | null;
  photos: DiaryPhoto[];
  publishedAt: string | null;
  updatedAt: string;
};
export type DiaryUpdate = Partial<{
  title: string;
  body: string;
  visibility: DiaryVisibility;
  locationPrecision: LocationPrecision;
  satisfaction: number | null;
  experienceTags: string[];
  includeInTasteProfile: boolean;
  coverPhotoId: number;
  photoOrder: number[];
}>;
/** 6-7·6-8 지도 핀 — 대표 사진 위치, 없으면 지역 중심 */
export type TravelMapPin = {
  diaryId: number;
  title: string;
  courseTitle: string | null;
  coverPhotoUrl: string | null;
  visitedAt: string;
  regionSigCd: string | null;
  regionName: string | null;
  lat: number;
  lng: number;
  locationPrecision: LocationPrecision;
  visibility: DiaryVisibility;
  status: DiaryStatus;
};

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
