# TriPin 프론트엔드 API 가이드

> 백엔드 `docs/api/` 명세를 프론트 작업용으로 정리한 문서입니다. 필드·오류 코드의 최종 기준은 백엔드 저장소의 `docs/api/`이고, 충돌하면 그쪽을 따릅니다.
> 로컬 Swagger: `http://localhost:8080/swagger-ui.html`

---

## 0. 먼저 알아둘 것

### 공통 규칙

| 항목 | 내용 |
|---|---|
| Base URL | `http://localhost:8080/api` (로컬) |
| 요청 형식 | `application/json` (여행기 사진 업로드만 `multipart/form-data`) |
| 성공 응답 | 래퍼 없이 데이터를 바로 반환. 생성은 `201`, 본문 없는 성공은 `204` |
| 날짜 | `YYYY-MM-DD` |
| 시각 | `YYYY-MM-DDTHH:mm:ss` (한국 시간, timezone 표기 없음) |
| 쿠키 | refresh·공유 링크가 HttpOnly 쿠키를 쓰므로 **모든 요청에 `credentials: 'include'`** (axios는 `withCredentials: true`) |
| CORS 허용 Origin (로컬) | `http://localhost:3000`, `http://localhost:5173` |
| 목록 | 대부분 전체 반환. 페이지네이션은 지도 핀(cursor)과 카카오 식당 검색(page)만 |

### 인증 방식

| 누가 | 무엇으로 | 어디에 쓰나 |
|---|---|---|
| 회원 | `Authorization: Bearer {accessToken}` (30분) | 거의 모든 API |
| refresh | `refresh_token` 쿠키 (14일, 서버가 자동 세팅) | `POST /auth/refresh` 만 |
| 코스 공유 링크로 들어온 사람 | `share_session` 쿠키 (2시간) | `GET /shared/courses` 만 (조회 전용) |
| 여행기 공유 링크로 들어온 사람 | `diary_share_session` 쿠키 (2시간) | `GET /shared/diaries` 만 (조회 전용) |

**토큰 처리 흐름**

1. 가입·로그인 응답의 `accessToken`을 메모리(상태)에 보관합니다. refresh token은 쿠키라 프론트가 만질 일이 없습니다.
2. API가 `401 AUTH_UNAUTHENTICATED`를 주면 `POST /auth/refresh`를 **한 번** 호출하고, 받은 새 `accessToken`으로 원래 요청을 재시도합니다.
3. refresh도 401이면 로그인 화면으로 보냅니다.
4. ⚠️ refresh를 동시에 여러 번 부르면 하나만 성공하고 나머지는 "토큰 재사용"으로 판정돼 **세션 전체가 끊깁니다.** refresh 요청은 하나로 묶어서(single-flight) 처리해 주세요.
5. 앱 첫 진입(새로고침) 시 `POST /auth/refresh`를 호출하면 로그인 상태를 복구할 수 있습니다.

### 오류 응답

모든 오류는 같은 모양입니다. **분기는 `status`가 아니라 `code`로** 해 주세요.

```json
{
  "timestamp": "2026-09-20T10:00:00Z",
  "status": 400,
  "code": "COMMON_INVALID_REQUEST",
  "message": "요청 값이 올바르지 않습니다.",
  "path": "/api/example",
  "fieldErrors": [{"field": "startDate", "message": "필수 값입니다."}],
  "details": {}
}
```

- `fieldErrors`: 입력값 검증 실패 때만 옵니다. 폼 필드 옆에 메시지를 그대로 보여주면 됩니다.
- `details`: 일부 오류만 추가 정보를 줍니다 (예: 날짜 겹침의 `conflicts`).
- `message`는 한글 사용자용 문구라서 토스트에 그대로 써도 됩니다.

| HTTP | code | 언제 |
|---:|---|---|
| 400 | `COMMON_INVALID_REQUEST` | 입력값·파라미터 오류 |
| 401 | `AUTH_UNAUTHENTICATED` | 토큰 없음·만료 → refresh 시도 |
| 403 | `AUTH_ACCESS_DENIED` | 권한 없음 |
| 404 | `COMMON_NOT_FOUND` | 없는 API 경로 |
| 500 | `COMMON_INTERNAL_ERROR` | 서버 오류 |

### 꼭 알아야 할 도메인 개념

| 개념 | 설명 |
|---|---|
| **trip id = course id** | 여행 하나에 코스 하나. `/courses/{tripId}`의 id는 여행 id입니다 |
| **`version` (낙관적 잠금)** | 여행마다 숫자 하나. 여행 수정·지역 정하기·코스 생성·편집 요청에 **직전에 받은 `version`을 같이 보내야** 합니다. 다른 사람이 먼저 고쳤으면 `409 TRIP_VERSION_CONFLICT` → 코스(`GET /courses/{tripId}`)를 다시 받아 화면을 갱신하고 다시 시도 |
| **참여자 권한은 모두 같음** | 만든 사람과 초대받은 사람이 똑같이 수정·초대·탈퇴할 수 있습니다. 예외: **최초 코스 생성만 만든 사람** |
| **끝난 여행은 읽기 전용** | 종료일이 지난 여행을 바꾸면 `409 TRIP_ENDED`. 조회·공유·탈퇴는 가능 |
| **접근 권한 없는 여행 = 404** | 남의 여행은 존재 자체를 숨기고 `404 TRIP_NOT_FOUND`로 응답합니다 |
| **밀도 `scheduleDensity`** | `RELAXED` = "여유롭게 둘러볼래요"(하루 관광지 최대 4곳), `PACKED` = "가능한 많이 둘러볼래요"(최대 6곳) |
| **이동수단 `transport`** | `WALK` \| `CAR` \| `PUBLIC_TRANSIT` |
| **관광지 유형 `category`** | `NATURE` 자연 · `HISTORY_CULTURE` 역사·문화 · `ACTIVITY` 체험·레포츠 · `WALK_REST` 산책·휴식 · `ETC` 기타 |
| **지역 코드 `sigCd`** | 시군구 5자리 문자열 (예: 경주시 `"47130"`) |

---

## 1. 화면 흐름별 호출 순서

| 흐름 | 호출 순서 |
|---|---|
| **A. 가입·온보딩** | `POST /auth/signup` → `GET /onboarding/questions` → (좋았던 지역 선택용) `GET /regions` → `POST /onboarding/submissions` |
| **B. 앱 진입** | `POST /auth/refresh` (로그인 복구) → `onboardingCompleted`가 `false`면 온보딩, `true`면 메인 |
| **C. 여행 만들기** | `GET /trips/unavailable-dates` (캘린더 비활성) → `POST /trips/context/check` (겹침·가능 지역 수 확인) → `POST /trips` |
| **D. 지역 정하기** | `GET /regions?days=&scheduleDensity=` (전국 지도) → `POST /trips/{id}/region` → `GET /regions/{sigCd}/card` (지역 소개 카드) |
| **E. 코스 만들기** | `POST /courses/{id}/generate` → 지도 `GET /regions/{sigCd}/attractions` · 상세 `GET /attractions/{id}` → 교체 후보 `GET /courses/{id}/alternatives` → 편집 `PATCH /courses/{id}/schedule` |
| **F. 식당 고르기** | `GET /courses/{id}/restaurants/recommendations` (비어 있으면) → `GET /courses/{id}/restaurants/search` → `PATCH /courses/{id}/schedule` (`SET_RESTAURANT`) |
| **G. 같이 갈 사람 초대** | 링크: `POST /trips/{id}/invites` → (받은 사람) `GET /invites/{token}` → 로그인·온보딩 → `POST /invites/{token}/accept` |
| | 친구 직접: `POST /trips/{id}/friend-invites` → (받은 사람) `GET /me/trip-invites` → `POST /me/trip-invites/{id}/accept` |
| **H. 코스 공유(읽기 전용)** | `POST /courses/{id}/share-links` → (받은 사람) `GET /shared/courses/{token}` → 자동으로 코스 JSON 수신 |
| **I. 친구 맺기** | `POST /friend-links` → (받은 사람) `GET /friend-links/by-token/{token}` → `POST /friend-links/by-token/{token}/accept` |
| **J. 여행기 (추가 기능)** | 여행 종료 후 `POST /courses/{id}/diary` → `POST /diaries/{id}/photos` → `PATCH /diaries/{id}` → `POST /diaries/{id}/publish` → `GET /me/travel-map` |

**프론트 라우트로 만들어야 하는 링크**

| 링크 | 프론트 라우트 예시 | 그 화면에서 부를 API |
|---|---|---|
| 여행 초대 | `/invite/{token}` | `GET /invites/{token}` → `POST /invites/{token}/accept` |
| 코스 공유 | `/shared/{token}` | `GET /shared/courses/{token}` |
| 친구 초대 | `/friend/{token}` | `GET /friend-links/by-token/{token}` → `POST .../accept` |
| 여행기 공유 | `/shared-diary/{token}` | `GET /shared/diaries/{token}` |

서버는 카카오톡 메시지를 보내지 않습니다. 발급받은 `token`으로 링크를 만들어 카카오톡 공유 SDK나 링크 복사로 보내 주세요.

---

## 2. 전체 API 한눈에 보기

호출 주체 — `공개` 로그인 불필요 · `회원` 로그인 필요 · `참여자` 그 여행 참여자 · `작성자` 그 여행기를 쓴 사람

### 인증

| Method | Path | 호출 | 설명 |
|---|---|---|---|
| POST | `/auth/signup` | 공개 | 회원가입 (바로 로그인 상태) |
| POST | `/auth/login` | 공개 | 로그인 |
| POST | `/auth/refresh` | 쿠키 | access token 재발급 |
| POST | `/auth/logout` | 공개 | 로그아웃 |
| GET | `/users/me` | 회원 | 내 정보 |

### 온보딩·설정

| Method | Path | 호출 | 설명 |
|---|---|---|---|
| GET | `/onboarding/questions` | 공개 | 설문 문항 |
| POST | `/onboarding/submissions` | 회원 | 설문 제출 (최초·재검사 공통) |
| GET | `/onboarding/me` | 회원 | 내 최신 설문 결과 |
| GET | `/me/preferences` | 회원 | 코스 취향 반영 기본값 |
| PATCH | `/me/preferences` | 회원 | 기본값 변경 |

### 친구

| Method | Path | 호출 | 설명 |
|---|---|---|---|
| POST | `/friend-links` | 회원 | 친구 초대 링크 만들기 |
| GET | `/friend-links` | 회원 | 내가 만든 친구 링크 목록 |
| DELETE | `/friend-links/{id}` | 회원 | 친구 링크 폐기 |
| GET | `/friend-links/by-token/{token}` | 공개 | 링크 미리보기 (누가 보냈는지) |
| POST | `/friend-links/by-token/{token}/accept` | 회원 | 수락 → 바로 친구 |
| GET | `/friends` | 회원 | 친구 목록 |
| DELETE | `/friends/{userId}` | 회원 | 친구 끊기 |

### 여행

| Method | Path | 호출 | 설명 |
|---|---|---|---|
| GET | `/trips/unavailable-dates` | 회원 | 캘린더에서 막을 날짜 |
| POST | `/trips/context/check` | 회원 | 날짜 겹침 미리 확인 |
| POST | `/trips` | 회원 | 여행 만들기 |
| GET | `/trips` | 회원 | 내 여행 목록 |
| GET | `/trips/{tripId}/context` | 참여자 | 여행 기본 정보 |
| PATCH | `/trips/{tripId}/context` | 참여자 | 이동수단·출발지 수정 |
| POST | `/trips/{tripId}/region` | 참여자 | 지역 정하기 (랜덤·조건·직접) |
| GET | `/trips/{tripId}/participants` | 참여자 | 참여자 목록 |
| DELETE | `/trips/{tripId}/participants/me` | 참여자 | 여행 나가기 (= 내 목록에서 삭제) |

### 초대·공유

| Method | Path | 호출 | 설명 |
|---|---|---|---|
| POST | `/trips/{tripId}/invites` | 참여자 | 초대 링크 만들기 |
| GET | `/trips/{tripId}/invites` | 참여자 | 초대 링크 목록 |
| DELETE | `/trips/{tripId}/invites/{inviteId}` | 참여자 | 초대 링크 폐기 |
| GET | `/invites/{token}` | 공개 | 초대 미리보기 |
| POST | `/invites/{token}/accept` | 회원 | 초대 링크 수락 |
| POST | `/trips/{tripId}/friend-invites` | 참여자 | 친구 직접 초대 |
| GET | `/trips/{tripId}/friend-invites` | 참여자 | 보낸 친구 초대 목록 |
| DELETE | `/trips/{tripId}/friend-invites/{inviteId}` | 참여자 | 친구 초대 취소 |
| GET | `/me/trip-invites` | 회원 | 받은 초대 목록 |
| POST | `/me/trip-invites/{id}/accept` | 회원 | 받은 초대 수락 |
| POST | `/me/trip-invites/{id}/decline` | 회원 | 받은 초대 거절 |
| POST | `/courses/{tripId}/share-links` | 참여자 | 코스 공유 링크 만들기 |
| GET | `/courses/{tripId}/share-links` | 참여자 | 공유 링크 목록 |
| DELETE | `/courses/{tripId}/share-links/{linkId}` | 참여자 | 공유 링크 폐기 |
| GET | `/shared/courses/{token}` | 공개 | 공유 링크 열기 (쿠키 발급) |
| GET | `/shared/courses` | 공유 쿠키 | 공유된 코스 보기 |

### 코스·식당

| Method | Path | 호출 | 설명 |
|---|---|---|---|
| POST | `/courses/{tripId}/generate` | 참여자 | 코스 생성·재생성 |
| GET | `/courses/{tripId}` | 참여자 | 코스 조회 |
| PATCH | `/courses/{tripId}/schedule` | 참여자 | 일정 편집 (추가·교체·삭제·이동·식당) |
| GET | `/courses/{tripId}/alternatives` | 참여자 | 대체·추가 후보 관광지 |
| GET | `/courses/{tripId}/restaurants/recommendations` | 참여자 | 식당 추천 |
| GET | `/courses/{tripId}/restaurants/search` | 참여자 | 카카오 식당 검색 |

### 지역·관광지

| Method | Path | 호출 | 설명 |
|---|---|---|---|
| GET | `/regions` | 회원 | 전국 250개 지역 |
| GET | `/regions/{sigCd}/card` | 회원 | 지역 소개 카드 |
| GET | `/regions/{sigCd}/attractions` | 회원 | 지도 관광지 핀 |
| GET | `/attractions/{attractionId}` | 회원 | 관광지 상세 |

### 여행기·사진 지도 (추가 기능)

| Method | Path | 호출 | 설명 |
|---|---|---|---|
| POST | `/courses/{tripId}/diary` | 참여자 | 여행기 초안 만들기 (여행 종료 후) |
| POST | `/diaries/{diaryId}/photos` | 작성자 | 사진 올리기 |
| DELETE | `/diaries/{diaryId}/photos/{photoId}` | 작성자 | 사진 삭제 |
| PATCH | `/diaries/{diaryId}` | 작성자 | 여행기 수정 |
| POST | `/diaries/{diaryId}/publish` | 작성자 | 발행 |
| GET | `/diaries/{diaryId}` | 작성자·친구 | 여행기 조회 |
| DELETE | `/diaries/{diaryId}` | 작성자 | 여행기 삭제 |
| GET | `/me/travel-map` | 회원 | 내 여행 지도 |
| GET | `/friends/{userId}/travel-map` | 친구 | 친구 여행 지도 |
| POST | `/diaries/{diaryId}/share-links` | 작성자 | 여행기 공유 링크 만들기 |
| GET | `/diaries/{diaryId}/share-links` | 작성자 | 여행기 공유 링크 목록 |
| DELETE | `/diaries/{diaryId}/share-links/{linkId}` | 작성자 | 여행기 공유 링크 폐기 |
| GET | `/shared/diaries/{token}` | 공개 | 여행기 공유 링크 열기 |
| GET | `/shared/diaries` | 공유 쿠키 | 공유된 여행기 보기 |

---

## 3. 인증

### 공통 응답 `AuthResponse` (가입·로그인·refresh)

```json
{
  "user": {"id": 1, "email": "user@example.com", "nickname": "tester", "profileImage": null},
  "accessToken": "eyJhbGciOi...",
  "tokenType": "Bearer",
  "expiresInSeconds": 1800,
  "onboardingCompleted": false
}
```

- `onboardingCompleted`로 첫 화면을 정합니다: `false` → 온보딩, `true` → 메인
- `profileImage`는 지금은 항상 `null`
- refresh token은 body에 없고 쿠키로 자동 세팅됩니다

### POST `/auth/signup` — 회원가입

```json
{"email": "user@example.com", "password": "password123", "nickname": "tester"}
```

| 필드 | 규칙 |
|---|---|
| `email` | 이메일 형식, 최대 190자 (서버가 공백 제거·소문자로 변환) |
| `password` | 8~64자 |
| `nickname` | 1~30자 |

- 응답 `201` `AuthResponse`
- 오류: `409 AUTH_DUPLICATE_EMAIL` 이메일 중복 · `400 COMMON_INVALID_REQUEST` 형식 오류 (`fieldErrors`)

### POST `/auth/login` — 로그인

```json
{"email": "user@example.com", "password": "password123"}
```

- 응답 `200` `AuthResponse`
- 오류: `401 AUTH_INVALID_CREDENTIALS` (이메일 없음·비밀번호 틀림을 구분하지 않음)

### POST `/auth/refresh` — 토큰 재발급

- body 없음. 쿠키가 자동으로 갑니다
- 응답 `200` 새 `AuthResponse`
- 오류: `401 AUTH_INVALID_REFRESH_TOKEN` → 로그인 화면으로
- ⚠️ 동시에 두 번 부르면 세션이 끊깁니다 (0장 토큰 처리 흐름 참고)

### POST `/auth/logout` — 로그아웃

- body 없음. 항상 `204`. 프론트는 메모리의 access token도 지워 주세요

### GET `/users/me` — 내 정보

```json
{"id": 1, "email": "user@example.com", "nickname": "tester", "profileImage": null, "onboardingCompleted": true}
```

---

## 4. 온보딩·설정

### GET `/onboarding/questions` — 설문 문항

```json
{
  "questionVersion": "aihub-traveler-v1",
  "travelStyles": [
    {"number": 1, "leftPole": "자연", "rightPole": "도시", "minValue": 1, "maxValue": 7, "neutralValue": 4, "evidence": "OFFICIAL"},
    {"number": 3, "leftPole": "새로운 지역", "rightPole": "익숙한 지역", "minValue": 1, "maxValue": 7, "neutralValue": 4, "evidence": "INFERRED"},
    {"number": 5, "leftPole": "휴양과 휴식", "rightPole": "체험 활동", "minValue": 1, "maxValue": 7, "neutralValue": 4, "evidence": "INFERRED"},
    {"number": 6, "leftPole": "잘 알려지지 않은 곳", "rightPole": "잘 알려진 명소", "minValue": 1, "maxValue": 7, "neutralValue": 4, "evidence": "INFERRED"}
  ],
  "travelMotives": [{"code": 1, "label": "일상에서 벗어나기"}, {"code": 2, "label": "휴식과 재충전"}],
  "maxTravelMotives": 3,
  "maxLikedRegions": 3,
  "excludeTags": ["계단·경사 많은 곳", "물놀이", "야간 이동", "오래 걷기"],
  "scheduleDensityOptions": ["RELAXED", "PACKED"]
}
```

**화면 구성**

| 영역 | UI | 데이터 |
|---|---|---|
| 여행 스타일 4문항 | 1~7 슬라이더 (왼쪽 `leftPole` ↔ 오른쪽 `rightPole`, 4는 중립) | `travelStyles` |
| 여행 동기 | 최대 3개 선택 | `travelMotives` (1~9) |
| 좋아하는 지역 | 최대 3개 선택 (`GET /regions`로 목록) | `sigCd` |
| 일정 밀도 | 2지선다 | `RELAXED` 여유롭게 / `PACKED` 가능한 많이 |
| 피하고 싶은 것 | 복수 선택 | `excludeTags` |

- 문항은 하드코딩하지 말고 이 응답으로 그려 주세요. `questionVersion`은 받은 값을 그대로 제출에 넣습니다.

### POST `/onboarding/submissions` — 설문 제출

최초 온보딩과 "여행 성향 다시 검사"가 같은 API입니다.

```json
{
  "questionVersion": "aihub-traveler-v1",
  "travelStyles": {"1": 1, "3": 4, "5": 6, "6": 7},
  "travelMotives": [2, 7],
  "likedRegions": ["11110", "41110"],
  "scheduleDensity": "RELAXED",
  "excludeTags": ["오래 걷기"]
}
```

| 필드 | 필수 | 규칙 |
|---|---|---|
| `questionVersion` | O | 문항 API에서 받은 값 그대로 |
| `travelStyles` | O | 키 `"1"`,`"3"`,`"5"`,`"6"` 모두, 값 1~7 |
| `travelMotives` | | 1~9, 중복 없이 최대 3개 |
| `likedRegions` | | `sigCd`, 중복 없이 최대 3개 |
| `scheduleDensity` | O | `RELAXED` \| `PACKED` |
| `excludeTags` | | 문항 API의 `excludeTags` 중에서 |

응답 `201`

```json
{
  "submissionId": "6c9f4b1e-...",
  "questionVersion": "aihub-traveler-v1",
  "scheduleDensity": "RELAXED",
  "profileText": "자연을 매우 선호, 체험 활동을 꽤 선호 ... 여행자.",
  "travelStyles": {"1": 1, "3": 4, "5": 6, "6": 7},
  "travelMotives": [2, 7],
  "likedRegions": ["11110", "41110"],
  "tasteStatus": "READY",
  "onboardingCompleted": true,
  "createdAt": "2026-09-21T20:00:00"
}
```

- `profileText`: 결과 화면에 보여줄 수 있는 성향 요약 문장
- `tasteStatus`: `READY` 취향 반영됨 · `PENDING` 처리 중 · `FAILED` 실패(추천은 기본값으로 동작). **어느 경우든 온보딩은 성공**이니 막지 마세요
- 오류 (모두 400): `ONBOARDING_INVALID_QUESTION_VERSION` (문항 다시 받기) · `ONBOARDING_INVALID_TRAVEL_STYLES` · `ONBOARDING_INVALID_TRAVEL_MOTIVE` · `ONBOARDING_INVALID_SCHEDULE_DENSITY` · `ONBOARDING_UNKNOWN_TAG` · `ONBOARDING_DUPLICATE_LIKED_REGION` · `ONBOARDING_TOO_MANY_LIKED_REGIONS` · `ONBOARDING_REGION_NOT_FOUND`

### GET `/onboarding/me` — 내 최신 설문 결과

```json
{"onboardingCompleted": true, "submission": { "...": "제출 응답과 같은 모양" }}
```

설문한 적 없으면 `{"onboardingCompleted": false, "submission": null}`

### GET·PATCH `/me/preferences` — 코스 취향 반영 기본값

```json
{"courseTasteMode": "TASTE"}
```

- `TASTE` 취향 반영 랜덤 (기본) · `RANDOM` 완전 랜덤
- PATCH body도 같은 모양. 응답은 바뀐 설정
- 코스 생성 때 `tasteMode`를 안 보내면 이 값이 쓰입니다 → 설정 화면의 토글로 쓰면 됩니다

---

## 5. 친구

친구는 **링크로만** 맺습니다 (검색·ID 입력 없음). 받은 사람이 수락하면 바로 친구가 됩니다.

### POST `/friend-links` — 친구 초대 링크 만들기

```json
{"expiresInDays": 7}
```

- `expiresInDays` 1~30, 생략하면 7
- 응답 `201` `{"id": 4, "token": "fl_9aZ...", "expiresAt": "...", "createdAt": "..."}`
- ⚠️ `token` 원문은 **이 응답에서만** 받을 수 있습니다. 바로 링크를 만들어 공유하세요
- 한 링크로 여러 명이 수락할 수 있습니다

### GET `/friend-links` — 내 친구 링크 목록

```json
[{"id": 4, "expiresAt": "2026-10-27T12:00:00", "revoked": false, "acceptedCount": 2, "createdAt": "2026-10-20T12:00:00"}]
```

만료·폐기된 링크도 포함합니다 (`revoked`, `expiresAt`으로 구분). token 원문은 없습니다.

### DELETE `/friend-links/{id}` — 링크 폐기

`204`. 이미 친구가 된 사람은 그대로입니다.

### GET `/friend-links/by-token/{token}` — 링크 미리보기 (로그인 불필요)

```json
{"valid": true, "inviterNickname": "여행친구"}
```

"○○님이 친구 신청을 보냈어요" 화면용입니다.

### POST `/friend-links/by-token/{token}/accept` — 수락

- body 없음. 비로그인이면 로그인·가입 후 호출
- 응답 `201` (이미 친구면 `200`) `{"userId": 12, "nickname": "여행친구", "since": "..."}`
- 오류: `400 FRIEND_LINK_SELF` 내가 만든 링크 · `404 FRIEND_LINK_NOT_FOUND` · `410 FRIEND_LINK_EXPIRED` / `FRIEND_LINK_REVOKED`

### GET `/friends` — 친구 목록

```json
[{"userId": 12, "nickname": "여행친구", "since": "2026-10-20T12:05:00"}]
```

### DELETE `/friends/{userId}` — 친구 끊기

`204`. 오류 `404 FRIEND_NOT_FOUND`

---

## 6. 여행

### 공통 응답 `TripContext`

```json
{
  "id": 42,
  "startDate": "2026-10-10",
  "endDate": "2026-10-12",
  "nights": 2,
  "transport": "WALK",
  "originLat": 37.5665,
  "originLng": 126.978,
  "regionSigCd": null,
  "regionSelection": null,
  "scheduleDensity": null,
  "hasCourse": false,
  "version": 0
}
```

| 필드 | 설명 |
|---|---|
| `nights` | 0~6박. `days = nights + 1` |
| `regionSigCd`, `regionSelection`, `scheduleDensity` | 지역 정하기 전에는 `null`. `regionSelection`은 `RANDOM` \| `CONDITIONAL` \| `MANUAL` |
| `hasCourse` | 코스에 일정이 있는지 |
| `version` | 다음 수정 요청에 그대로 보낼 값 |

**여행 화면 진입 시 분기**

- `regionSigCd == null` → 지역 정하기 화면
- `hasCourse == false` → 코스 만들기 화면
- 그 외 → 코스 화면 (`GET /courses/{tripId}`)

### GET `/trips/unavailable-dates?from=2026-10-01&to=2026-12-31` — 막을 날짜

```json
[{"tripId": 1, "startDate": "2026-10-01", "endDate": "2026-10-04"}]
```

캘린더에 이 기간을 비활성 표시합니다. 내 여행끼리는 날짜가 겹칠 수 없습니다.

### POST `/trips/context/check` — 날짜 겹침 미리 확인

```json
{"startDate": "2026-10-10", "nights": 2}
```

```json
{
  "available": false,
  "endDate": "2026-10-12",
  "conflicts": [{"tripId": 1, "title": "10월 1일부터 3박 4일 여행", "startDate": "2026-10-01", "endDate": "2026-10-04"}],
  "eligibleRegionCount": 12
}
```

- 저장하지 않습니다. 겹쳐도 `200`이고 `available: false`
- `eligibleRegionCount == 0`이면 "이 기간에 맞는 지역이 아직 없어요" 경고 (만들기를 막지는 않음)

### POST `/trips` — 여행 만들기

```json
{"startDate": "2026-10-10", "nights": 2, "transport": "WALK", "originLat": 37.5665, "originLng": 126.9780}
```

| 필드 | 필수 | 규칙 |
|---|---|---|
| `startDate` | O | **내일 이후** |
| `nights` | O | 0~6 (0 = 당일치기) |
| `transport` | O | `WALK` \| `CAR` \| `PUBLIC_TRANSIT` |
| `originLat`, `originLng` | | 출발지. 둘 다 주거나 둘 다 생략. "가까운 곳" 추첨에 쓰임 |

- 응답 `201` `TripContext`
- 오류: `400 TRIP_INVALID_START_DATE` / `TRIP_INVALID_NIGHTS` / `TRIP_INVALID_TRANSPORT` / `TRIP_INVALID_ORIGIN` · `409 ONBOARDING_REQUIRED` 설문 먼저 · `409 TRIP_DATE_OVERLAP` 날짜 겹침 (`details.conflicts`)

### GET `/trips?period=UPCOMING` — 내 여행 목록

`period`: `UPCOMING` 다가오는 여행 · `PAST` 지난 여행 · 생략 시 전체. 시작일 오름차순.

```json
[
  {
    "tripId": 42,
    "title": "경주, 신라의 시간을 걷는 2일",
    "regionSigCd": "47130",
    "regionName": "경상북도 경주시",
    "startDate": "2026-10-10",
    "endDate": "2026-10-12",
    "nights": 2,
    "participants": [{"userId": 1, "nickname": "나"}, {"userId": 12, "nickname": "여행친구"}],
    "hasCourse": true,
    "myDiaryId": null,
    "updatedAt": "2026-10-01T21:00:00"
  }
]
```

- `title`은 항상 값이 있습니다 (코스 제목이 없으면 "10월 10일부터 2박 3일 여행" 같은 대체 제목)
- `myDiaryId`: 이 여행에 내가 쓴 여행기 id, 없으면 `null`

### GET `/trips/{tripId}/context` — 여행 기본 정보

응답 `TripContext`. 오류 `404 TRIP_NOT_FOUND`

### PATCH `/trips/{tripId}/context` — 이동수단·출발지 수정

```json
{"transport": "CAR", "originLat": 37.5665, "originLng": 126.9780, "version": 0}
```

- 날짜는 바꿀 수 없습니다 (보내면 400)
- 출발지를 지우려면 `originLat`, `originLng` 둘 다 `null`
- 코스가 있어도 바꿀 수 있고, 서버가 이동시간만 다시 계산합니다
- 응답 `200` `TripContext` (`version` 증가)
- 오류: `409 TRIP_VERSION_CONFLICT` · `409 TRIP_ENDED`

### POST `/trips/{tripId}/region` — 지역 정하기

랜덤 뽑기, 조건 뽑기, 지도에서 직접 고르기가 모두 이 API입니다. "다시 뽑기"도 같은 요청을 다시 보내면 됩니다.

```json
{"mode": "CONDITIONAL", "conditions": ["DISTANCE", "MY_TASTE"], "sigCd": null, "scheduleDensity": "RELAXED", "replaceCourse": false, "version": 0}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| `mode` | O | `RANDOM` 랜덤 · `CONDITIONAL` 조건 · `MANUAL` 직접 선택 |
| `conditions` | `CONDITIONAL`이면 O | `DISTANCE` 출발지에서 가까운 곳 · `MY_TASTE` 내 취향 (1개 이상) |
| `sigCd` | `MANUAL`이면 O | 지도에서 고른 지역 |
| `scheduleDensity` | | 생략하면 여행의 기존 값 → 없으면 내 설문 값 |
| `replaceCourse` | | 코스가 이미 있으면 `true` 필수 |
| `version` | O | 직전에 받은 `version` |

```json
{
  "tripId": 42,
  "regionSigCd": "47130",
  "province": "경상북도",
  "city": "경주시",
  "regionSelection": "CONDITIONAL",
  "scheduleDensity": "RELAXED",
  "appliedConditions": ["MY_TASTE"],
  "ignoredConditions": [{"condition": "DISTANCE", "reason": "ORIGIN_MISSING"}],
  "candidateCount": 187,
  "warnings": [],
  "version": 1
}
```

- `ignoredConditions[].reason`: `ORIGIN_MISSING` 출발지 없음 · `TASTE_NOT_READY` 취향 분석 전 → "출발지가 없어 거리 조건은 빼고 뽑았어요" 같은 안내
- `warnings`에 `ALL_CONDITIONS_IGNORED`가 있으면 조건 없이 랜덤으로 뽑힌 것
- 결과 뒤에 `GET /regions/{sigCd}/card`로 지역 소개 카드를 보여주세요

**코스가 이미 있을 때 지역 바꾸기**

1. `replaceCourse: false`로 보내면 `409 TRIP_CONTEXT_LOCKED`
2. "코스를 비우고 다시 만들어요" 확인 모달을 띄우고
3. `replaceCourse: true`로 다시 보내면 지역이 바뀌고 **코스가 비워집니다**

| 오류 | 의미 |
|---|---|
| `400 DRAW_INVALID_MODE` / `DRAW_NO_CONDITION_SELECTED` | 모드·조건 값 오류 |
| `404 REGION_NOT_FOUND` | 없는 `sigCd` |
| `409 TRIP_CONTEXT_LOCKED` | 위 확인 흐름 필요 |
| `409 TRIP_VERSION_CONFLICT` | 다른 사람이 먼저 수정함 |
| `422 DRAW_REGION_NOT_ELIGIBLE` | 직접 고른 지역이 관광지가 부족해서 코스를 못 만듦 |
| `422 DRAW_NO_ELIGIBLE_REGION` | 뽑을 수 있는 지역이 없음 |

### GET `/trips/{tripId}/participants` — 참여자 목록

```json
[
  {"userId": 1, "nickname": "만든사람", "isCreator": true, "joinedAt": "2026-10-01T10:00:00"},
  {"userId": 12, "nickname": "여행친구", "isCreator": false, "joinedAt": "2026-10-01T12:00:00"}
]
```

`isCreator`는 표시용 배지일 뿐 권한 차이는 없습니다. 참여자는 최대 8명입니다.

### DELETE `/trips/{tripId}/participants/me` — 여행 나가기

- `204`. "내 여행에서 삭제" 버튼이 이 API입니다 (여행 삭제 API는 따로 없음)
- 마지막 참여자가 나가면 여행·코스·링크가 모두 삭제됩니다
- 내가 쓴 여행기는 남습니다

---

## 7. 초대·공유

- **초대** = 회원을 여행 참여자로 들이기 (같이 편집)
- **공유** = 참여하지 않는 사람에게 코스를 **읽기 전용**으로 보여주기 (비회원도 가능)

### 링크 목록 공통 항목 `LinkSummary`

```json
{"id": 1, "expiresAt": "2026-09-30T12:00:00", "revoked": false, "createdBy": {"userId": 1, "nickname": "만든사람"}, "createdAt": "2026-09-23T12:00:00"}
```

### 초대 링크

| API | 설명 |
|---|---|
| POST `/trips/{tripId}/invites` | body `{"expiresInDays": 7}` (1~30, 기본 7) → `201` `{"id", "token": "iv_...", "expiresAt", "createdAt"}` |
| GET `/trips/{tripId}/invites` | `LinkSummary[]` 최신순 |
| DELETE `/trips/{tripId}/invites/{inviteId}` | `204` 폐기. 이미 들어온 사람은 그대로 |

⚠️ `token` 원문은 발급 응답에서만 받을 수 있습니다.

### GET `/invites/{token}` — 초대 미리보기 (로그인 불필요)

```json
{"valid": true, "title": "10월 3일부터 2박 3일 여행", "startDate": "2026-10-03", "endDate": "2026-10-05", "regionName": "경상북도 경주시", "inviterNickname": "여행친구", "participantCount": 2}
```

### POST `/invites/{token}/accept` — 초대 수락

- body 없음. 응답 `201` `TripContext` (이미 참여 중이면 `200`)
- **수락 전 프론트 체크 순서**: 로그인 안 됨 → 로그인·가입 / 온보딩 안 함 → 온보딩 → 그 다음 수락 호출

| 오류 | 의미 / 화면 처리 |
|---|---|
| `409 ONBOARDING_REQUIRED` | 설문 화면으로 |
| `409 TRIP_DATE_OVERLAP` | 내 다른 여행과 날짜 겹침 (`details.conflicts`) → 기존 여행에서 나가야 함 |
| `409 TRIP_FULL` | 참여자 8명 꽉 참 |
| `409 TRIP_ENDED` | 끝난 여행 |
| `404 INVITE_NOT_FOUND` | 없는 링크 |
| `410 INVITE_EXPIRED` / `INVITE_REVOKED` | 만료·폐기된 링크 |

### 친구 직접 초대

| API | 설명 |
|---|---|
| POST `/trips/{tripId}/friend-invites` | body `{"friendUserId": 12}` → `201` (이미 대기 중이면 `200` 같은 응답) |
| GET `/trips/{tripId}/friend-invites` | 이 여행에서 보낸 친구 초대 목록 (참여자 모두 같은 목록) |
| DELETE `/trips/{tripId}/friend-invites/{inviteId}` | `204` 대기 중인 초대 취소 (누가 보냈든 참여자면 가능) |

```json
{"id": 9, "tripId": 42, "invitee": {"userId": 12, "nickname": "여행친구"}, "status": "PENDING", "createdAt": "2026-10-01T12:00:00"}
```

- `status`: `PENDING` 대기 · `ACCEPTED` 수락 · `DECLINED` 거절 · `CANCELLED` 취소
- 거절·취소된 친구는 다시 초대할 수 있습니다
- 오류: `409 INVITE_ALREADY_HANDLED` 이미 참여 중 · `404 FRIEND_NOT_FOUND` 친구 아님
- 푸시 알림은 없습니다. 받은 사람은 "받은 초대" 화면에서 확인합니다

### 받은 초대

**GET `/me/trip-invites`** — 대기 중인 초대만, 최신순

```json
[
  {
    "id": 9,
    "trip": {"tripId": 42, "title": "10월 10일부터 2박 3일 여행", "startDate": "2026-10-10", "endDate": "2026-10-12", "regionName": "경상북도 경주시"},
    "inviter": {"userId": 1, "nickname": "만든사람"},
    "dateConflict": false,
    "createdAt": "2026-10-01T12:00:00"
  }
]
```

- `dateConflict: true`면 수락 버튼을 비활성화하고 "다른 여행과 날짜가 겹쳐요"를 보여주세요

**POST `/me/trip-invites/{id}/accept`** → `201` `TripContext`
**POST `/me/trip-invites/{id}/decline`** → `204`

오류: `409 INVITE_ALREADY_HANDLED` 이미 처리·취소됨 · 그 외는 초대 링크 수락과 같음

### 코스 공유 링크 (읽기 전용)

| API | 설명 |
|---|---|
| POST `/courses/{tripId}/share-links` | body `{"expiresInDays": 7}` → `201` `{"id", "token": "sl_...", "expiresAt", "createdAt"}` |
| GET `/courses/{tripId}/share-links` | `LinkSummary[]` |
| DELETE `/courses/{tripId}/share-links/{linkId}` | `204` 폐기 (이미 보고 있던 사람도 즉시 차단) |

**공유 링크를 받은 사람의 화면 (`/shared/{token}` 라우트)**

```js
const res = await fetch(`${API}/api/shared/courses/${token}`, { credentials: 'include' });
// 서버가 쿠키를 세팅하고 303으로 /api/shared/courses 로 보냄 → 브라우저가 따라가서 코스 JSON을 받음
const course = await res.json();
history.replaceState(null, '', '/shared'); // 주소창에서 token 지우기
```

- 응답은 코스(`Course`)와 같은 모양이고 `myRole: "VIEWER"` → 편집 UI를 숨깁니다
- 공유로 들어온 사람은 지역 카드·지도 핀·관광지 상세 API를 **부를 수 없습니다.** 코스 응답 안의 `name`, `thumbnailUrl`, `lat`, `lng`, `restaurant` 등으로 화면을 그려 주세요
- 새로고침 때는 `GET /shared/courses`만 다시 부르면 됩니다 (쿠키 2시간 유효)
- 코스가 아직 없으면 404가 아니라 `days: []`로 옵니다
- 오류: `401 SHARE_SESSION_INVALID` 쿠키 만료 · `404 SHARE_LINK_NOT_FOUND` · `410 SHARE_LINK_EXPIRED` / `SHARE_LINK_REVOKED` → 모두 "더 이상 열 수 없는 링크"
- ⚠️ 쿠키가 전달되려면 프론트와 API가 같은 사이트(등록 도메인)여야 합니다

---

## 8. 코스·식당

### 코스란

- 여행의 **날짜별 방문 순서 목록**입니다. 관광지와 식사(점심·저녁)가 한 목록에 섞여 있습니다
- **시각(몇 시)은 없습니다.** 체류시간과 이동시간은 참고용입니다
- 매일 점심(`LUNCH`)·저녁(`DINNER`) 슬롯이 하나씩 자동으로 들어갑니다. 식당은 사용자가 고르고, 안 고르면 "미정"

### 응답 `Course`

```json
{
  "tripId": 42,
  "version": 3,
  "myRole": "PARTICIPANT",
  "regionSigCd": "47130",
  "regionName": "경상북도 경주시",
  "startDate": "2026-10-10",
  "endDate": "2026-10-11",
  "scheduleDensity": "RELAXED",
  "title": "경주, 역사를 따라 걷는 2일",
  "titleSource": "RULE",
  "recommendationMode": "PERSONALIZED",
  "tasteBasis": {"userId": 1, "nickname": "만든사람"},
  "days": [
    {
      "dayIndex": 0,
      "date": "2026-10-10",
      "items": [
        {"itemId": "a-101", "type": "ATTRACTION", "attractionId": 5012, "name": "대릉원", "category": "HISTORY_CULTURE",
         "thumbnailUrl": "https://…", "address": "경북 경주시 황남동 …", "lat": 35.838, "lng": 129.211, "durationMinutes": 90,
         "travelFromPreviousMinutes": null, "estimated": true, "source": "RECOMMEND", "reason": "역사 선호와 맞아요"},
        {"itemId": "m-31", "type": "MEAL", "meal": "LUNCH", "durationMinutes": 60, "travelFromPreviousMinutes": null, "restaurant": null},
        {"itemId": "a-102", "type": "ATTRACTION", "attractionId": 5020, "name": "경주 동궁과 월지", "category": "NATURE",
         "thumbnailUrl": "https://…", "address": "…", "lat": 35.834, "lng": 129.226, "durationMinutes": 90,
         "travelFromPreviousMinutes": 10, "estimated": true, "source": "RECOMMEND", "reason": "자연·산책 선호와 맞아요"},
        {"itemId": "m-32", "type": "MEAL", "meal": "DINNER", "durationMinutes": 60, "travelFromPreviousMinutes": null, "restaurant": null}
      ]
    }
  ],
  "warnings": [{"code": "ROUTE_TIME_ESTIMATED", "dayIndex": null, "itemId": null}],
  "updatedBy": {"userId": 12, "nickname": "여행친구"},
  "updatedAt": "2026-10-01T21:00:00"
}
```

| 필드 | 설명 |
|---|---|
| `version` | 다음 편집 요청에 그대로 보냄 |
| `myRole` | `PARTICIPANT` 편집 가능 · `VIEWER` 공유 링크 (읽기 전용) |
| `recommendationMode` | `PERSONALIZED` 취향 반영 · `TOUR_OFFICIAL` 관광공사 공식 코스 기반 · `RULE_BASED` 기본 규칙 · `RANDOM` 완전 랜덤 |
| `tasteBasis` | 누구 취향으로 만든 코스인지 ("○○님 취향으로 만든 코스"). 공유 화면에선 `null` |
| `days[].items` | **배열 순서 = 방문 순서**. 별도 순서 필드 없음 |
| `itemId` | 관광지 `a-{n}`, 식사 `m-{n}`. 편집할 때 대상 지정에 사용. 재생성하면 전부 바뀜 |
| `travelFromPreviousMinutes` | 앞 관광지에서 오는 이동시간(분, 직선거리 추정). 식사 항목·그날 첫 관광지는 `null` |
| `source` | `RECOMMEND` 자동 추천 · `MANUAL` 사용자가 넣음 |
| `reason` | 추천 이유 문구 (`MANUAL`이면 `null`) |
| `restaurant` | 고른 식당 (`RestaurantSnapshot`), 없으면 `null` → "미정" |
| `updatedBy` | 마지막으로 고친 사람 |

**항목 타입별 필드**

| 필드 | `ATTRACTION` 관광지 | `MEAL` 식사 |
|---|---|---|
| `attractionId`, `name`, `category`, `lat`, `lng` | O | — |
| `thumbnailUrl`, `address` | O (null 가능) | — |
| `estimated`, `source`, `reason` | O | — |
| `meal` | — | `LUNCH` \| `DINNER` |
| `restaurant` | — | 식당 또는 `null` |

**`warnings[].code` 화면 처리**

| code | 의미 | 화면 |
|---|---|---|
| `ROUTE_TIME_ESTIMATED` | 이동시간이 직선거리 추정치 | "이동시간은 대략적인 값이에요" (항상 붙음) |
| `DENSITY_TARGET_NOT_MET` | 관광지가 부족해 목표보다 적게 배치됨 (`dayIndex`) | 해당 날짜에 안내. 생성 응답에만 있음 |
| `PERSONALIZATION_FALLBACK` | 취향 분석을 못 써서 기본 추천으로 만듦 | "취향 분석이 준비되지 않아 기본 추천으로 만들었어요" |
| `TITLE_GENERATION_FAILED` | AI 제목 실패 → 기본 제목 사용 | 보통 무시 |
| `ATTRACTION_NO_LONGER_RECOMMENDABLE` | 이 장소가 추천 대상에서 빠짐 (`itemId`) | 해당 항목에 표시 + "다른 장소로 바꾸기" 제안 |

**`RestaurantSnapshot` (고른 식당)**

```json
{
  "provider": "TOUR_API",
  "externalId": "2871024",
  "name": "황남맷돌순두부",
  "category": "한식",
  "address": "경북 경주시 …",
  "roadAddress": "경북 경주시 …",
  "lat": 35.83, "lng": 129.21,
  "phone": "054-…",
  "placeUrl": null,
  "imageUrl": "https://…",
  "representativeMenu": "순두부찌개",
  "evidenceLabels": ["한국관광공사 등록 음식점"],
  "sources": [{"name": "한국관광공사 TourAPI", "url": "https://…", "fetchedAt": "2026-09-30T00:00:00"}]
}
```

- `provider`: `TOUR_API` · `FARM_RESTAURANT` 농가맛집 · `MODEL_RESTAURANT` 모범음식점 · `GOOD_PRICE` 착한가격업소 · `KAKAO`
- `evidenceLabels`: 식당 카드에 배지로 보여줄 출처 문구

### POST `/courses/{tripId}/generate` — 코스 생성·재생성

```json
{"scheduleDensity": "RELAXED", "version": 2, "tasteMode": "TASTE"}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| `version` | O | 직전에 받은 `version` |
| `scheduleDensity` | | 생략하면 여행의 현재 밀도 |
| `tasteMode` | | `TASTE` \| `RANDOM`. 생략하면 내 설정(`/me/preferences`) |

- 응답 `201` `Course`
- **최초 생성은 여행을 만든 사람만** 할 수 있습니다. 다른 참여자에겐 버튼을 숨기거나 "만든 사람이 코스를 만들면 함께 볼 수 있어요" 안내 (`403 COURSE_CREATOR_ONLY`)
- 재생성은 참여자 누구나 가능하고, **누른 사람의 취향**으로 만듭니다
- ⚠️ 재생성은 다른 사람의 편집과 식당 선택을 **모두 덮어씁니다.** "다른 참여자의 편집과 식당 선택도 사라집니다" 확인 모달 필수
- 같은 조건으로 다시 눌러도 다른 코스가 나옵니다 (랜덤 여행 컨셉)

| 오류 | 의미 |
|---|---|
| `403 COURSE_CREATOR_ONLY` | 최초 생성은 만든 사람만 |
| `409 TRIP_REGION_NOT_SELECTED` | 지역을 먼저 정해야 함 |
| `409 TRIP_VERSION_CONFLICT` | 다른 사람이 먼저 수정 → 다시 조회 |
| `422 COURSE_INSUFFICIENT_CANDIDATES` | 관광지가 부족해 하루 1곳도 못 채우는 날이 있음 (`details.days`) → 지역 변경 유도 |

### GET `/courses/{tripId}` — 코스 조회

응답 `200` `Course`. 코스가 없으면 `404 COURSE_NOT_FOUND` → 코스 만들기 화면으로

### PATCH `/courses/{tripId}/schedule` — 일정 편집

여러 작업을 한 번에 보낼 수 있고, **전부 성공하거나 전부 실패**합니다 (1~20개).

```json
{
  "version": 3,
  "operations": [
    {"op": "REPLACE", "itemId": "a-101", "attractionId": 5020},
    {"op": "ADD", "dayIndex": 1, "position": 2, "attractionId": 5033},
    {"op": "MOVE", "itemId": "a-104", "dayIndex": 0, "position": 1},
    {"op": "REMOVE", "itemId": "a-105"},
    {"op": "SET_RESTAURANT", "itemId": "m-31", "selectionToken": "rs_eyJ..."},
    {"op": "CLEAR_RESTAURANT", "itemId": "m-32"}
  ]
}
```

| op | 필드 | 대상 | 설명 |
|---|---|---|---|
| `ADD` | `dayIndex`, `position?`, `attractionId` | — | 관광지 추가. `position`은 그날 목록(식사 포함)의 위치(0부터), 생략하면 맨 뒤 |
| `REPLACE` | `itemId`, `attractionId` | 관광지 | 다른 관광지로 교체 (`itemId` 유지) |
| `REMOVE` | `itemId` | 관광지 | 삭제. **식사는 삭제 불가** |
| `MOVE` | `itemId`, `dayIndex`, `position` | 관광지·식사 | 순서 변경 (드래그 앤 드롭). 관광지는 다른 날로도, **식사는 같은 날 안에서만** |
| `SET_RESTAURANT` | `itemId`, `selectionToken` | 식사 | 식당 지정. 추천·검색 결과의 `selectionToken`을 그대로 |
| `CLEAR_RESTAURANT` | `itemId` | 식사 | 식당 선택 해제 |

- 응답 `200` 갱신된 `Course` (`version` +1). 응답으로 화면을 통째로 다시 그리면 됩니다
- 개수 제한 없음 (밀도보다 많이 넣어도 됨), 관광지 0곳인 날도 허용
- 추가·교체할 관광지는 같은 지역이면서 추천 가능하고 아직 일정에 없어야 합니다

| 오류 | 의미 |
|---|---|
| `400 COURSE_INVALID_OPERATION` | 잘못된 작업 (식사 삭제, 식사를 다른 날로 이동 등) |
| `404 COURSE_ITEM_NOT_FOUND` / `ATTRACTION_NOT_FOUND` | 없는 항목·관광지 |
| `409 TRIP_VERSION_CONFLICT` | 다른 사람이 먼저 수정 → `GET /courses/{tripId}`로 다시 받고 재시도 |
| `409 ATTRACTION_ALREADY_IN_COURSE` | 이미 일정에 있는 장소 |
| `422 ATTRACTION_NOT_RECOMMENDABLE` | 추천 불가 장소 (지도에서 흐린 핀) |
| `422 ATTRACTION_REGION_MISMATCH` | 다른 지역 장소 |
| `422 COURSE_RESTAURANT_SELECTION_INVALID` | 식당 토큰 만료(30분)·다른 슬롯 → 식당 목록을 다시 받기 |

### GET `/courses/{tripId}/alternatives` — 교체·추가 후보

```
GET /api/courses/{tripId}/alternatives?itemId=a-101&category=NATURE&limit=10
GET /api/courses/{tripId}/alternatives?itemId=a-101&q=월정
```

| Query | 설명 |
|---|---|
| `itemId` | 교체할 관광지. 주면 그 자리 기준 이동시간을 반영해 정렬. 생략하면 "추가"용 후보 |
| `category` | 유형 필터. 생략하면 전 유형 |
| `limit` | 유형별 개수 (기본 10, 최대 30) |
| `q` | 이름 검색어 (1~50자) |

```json
{
  "itemId": "a-101",
  "groups": [
    {
      "category": "NATURE",
      "label": "자연",
      "items": [
        {"attractionId": 5020, "name": "경주 동궁과 월지", "category": "NATURE", "thumbnailUrl": "https://…",
         "lat": 35.834, "lng": 129.226, "estimatedDurationMinutes": 90,
         "travelFromPreviousMinutes": 10, "reason": "자연·산책 선호와 맞아요"}
      ]
    }
  ]
}
```

- 유형별 그룹 → 탭 UI로 쓰기 좋습니다. 교체 화면은 검색창 + 추천 목록을 같이 보여주는 구성
- 고르면 `PATCH /schedule`에 `REPLACE` 또는 `ADD`로 보냅니다
- 식사 항목의 `itemId`를 주면 `400 COURSE_INVALID_OPERATION`

### GET `/courses/{tripId}/restaurants/recommendations` — 식당 추천

```
GET /api/courses/{tripId}/restaurants/recommendations?itemId=m-31&radius=5000
```

| Query | 필수 | 설명 |
|---|---|---|
| `itemId` | O | 식사 슬롯 (`m-…`) |
| `radius` | | 미터. 기본 5000, 최대 20000 |

```json
{
  "itemId": "m-31",
  "origin": {"type": "PREVIOUS_ATTRACTION", "attractionId": 5012, "lat": 35.838, "lng": 129.211},
  "regionFoodThemes": [{"name": "경주 찰보리빵", "sources": [{"name": "경주시청", "url": "https://…"}]}],
  "sections": [
    {"source": "TOUR_API", "label": "한국관광공사 등록 음식점", "items": [
      {"selectionToken": "rs_eyJ...", "distanceMeters": 420, "name": "황남맷돌순두부", "...": "RestaurantSnapshot 필드들"}
    ]},
    {"source": "FARM_RESTAURANT", "label": "농촌진흥청 농가맛집", "items": []},
    {"source": "MODEL_RESTAURANT", "label": "지자체 모범·향토음식점", "items": []},
    {"source": "GOOD_PRICE", "label": "착한가격업소", "items": []}
  ]
}
```

- 기준점(`origin`)은 식사 바로 앞 관광지, 없으면 지역 중심 (`origin.type`: `PREVIOUS_ATTRACTION` \| `REGION_CENTER`)
- `sections` 순서가 우선순위. 섹션별 거리순 최대 20개. **MVP에서는 `TOUR_API` 섹션만 채워지고** 나머지는 빈 배열
- `regionFoodThemes`가 빈 배열이면 영역을 숨겨 주세요
- **모든 섹션이 비어 있으면 같은 `itemId`로 카카오 검색(아래)을 자동 호출**해서 보여주세요
- 식당을 고르면 `PATCH /schedule`에 `{"op": "SET_RESTAURANT", "itemId": "m-31", "selectionToken": "rs_..."}`
- ⚠️ `selectionToken`: 해석하지 말고 그대로 body에 넣습니다 (URL query에 넣지 말 것). **30분 후 만료**되고 그 슬롯에서만 쓸 수 있습니다

### GET `/courses/{tripId}/restaurants/search` — 카카오 식당 검색

```
GET /api/courses/{tripId}/restaurants/search?itemId=m-31&query=칼국수&radius=5000&page=1
```

| Query | 필수 | 설명 |
|---|---|---|
| `itemId` | O | 식사 슬롯 |
| `query` | | 검색어 1~50자. 생략하면 주변 음식점 전체 |
| `radius` | | 기본 5000, 최대 20000 |
| `page` | | 1부터, 최대 45 |

```json
{
  "itemId": "m-31",
  "origin": {"type": "PREVIOUS_ATTRACTION", "attractionId": 5012, "lat": 35.838, "lng": 129.211},
  "page": 1,
  "isEnd": false,
  "items": [
    {"selectionToken": "rs_eyJ...", "provider": "KAKAO", "externalId": "12345678", "name": "○○칼국수",
     "category": "음식점 > 한식 > 국수", "address": "…", "roadAddress": "…", "lat": 35.84, "lng": 129.21,
     "distanceMeters": 380, "phone": "054-…", "placeUrl": "https://place.map.kakao.com/12345678",
     "imageUrl": null, "representativeMenu": null, "evidenceLabels": ["카카오맵 검색 결과"], "sources": []}
  ]
}
```

- 무한 스크롤: `isEnd == false`면 `page + 1`로 다음 페이지
- `placeUrl`로 카카오맵 상세 링크를 열 수 있습니다
- 오류: `502 COURSE_KAKAO_LOCAL_UNAVAILABLE` 카카오 장애 · `503 COURSE_KAKAO_LOCAL_RATE_LIMITED` 호출 한도 (`Retry-After` 헤더) → "잠시 후 다시 시도해 주세요"

---

## 9. 지역·관광지

공유 링크로 들어온 사람(비회원)은 이 장의 API를 부를 수 없습니다.

### GET `/regions` — 전국 지역 목록

```
GET /api/regions?days=3&scheduleDensity=RELAXED   ← 여행 지역 고르기 (추첨 가능 여부 포함)
GET /api/regions                                   ← 온보딩 좋아하는 지역 선택 (목록만)
```

```json
{
  "days": 3,
  "scheduleDensity": "RELAXED",
  "eligibleCount": 187,
  "regions": [
    {"sigCd": "47130", "province": "경상북도", "city": "경주시", "centerLat": 35.856, "centerLng": 129.225, "drawEligible": true, "ineligibleReasons": []},
    {"sigCd": "47940", "province": "경상북도", "city": "울릉군", "centerLat": 37.484, "centerLng": 130.905, "drawEligible": false, "ineligibleReasons": ["INSUFFICIENT_ATTRACTIONS"]}
  ]
}
```

- 250개 전체가 옵니다. `drawEligible: false` 지역도 지도에는 그리되 비활성(선택 불가) 처리
- `days`는 여행 일수(`nights + 1`, 1~7), `scheduleDensity`는 여행의 밀도 (없으면 생략)
- `days` 없이 부르면 `days`, `scheduleDensity`, `eligibleCount`, `drawEligible`, `ineligibleReasons`가 모두 `null`
- 오류: `400 REGION_INVALID_DAYS`

### GET `/regions/{sigCd}/card` — 지역 소개 카드

```json
{
  "sigCd": "47130",
  "province": "경상북도",
  "city": "경주시",
  "title": "천년의 시간이 머무는 도시",
  "introduction": ["첫 문단…", "둘째 문단…"],
  "heroImage": {"url": "https://…", "sourceName": "한국관광공사", "sourceUrl": "https://…", "license": "공공누리 1유형"},
  "characteristics": ["역사 유적", "야경"],
  "historyHighlights": ["신라의 수도"],
  "landmarks": [{"attractionId": 5012, "name": "대릉원", "thumbnailUrl": "https://…"}],
  "sources": [{"name": "한국관광공사 TourAPI", "url": "https://…"}],
  "updatedAt": "2026-09-30T00:00:00"
}
```

- 소개 콘텐츠가 없는 지역도 많습니다. 이 경우 `title` = 도시명, 배열은 모두 `[]`, `heroImage`·`updatedAt`은 `null` → **빈 값이면 해당 영역을 숨기는** 레이아웃으로 만들어 주세요
- `introduction`은 문단 배열 → `<p>` 여러 개
- `heroImage.sourceName`, `license`는 이미지 아래 출처 표기용
- `landmarks` 최대 3개

### GET `/regions/{sigCd}/attractions` — 지도 관광지 핀

```
GET /api/regions/{sigCd}/attractions?bbox=129.15,35.78,129.30,35.90&category=NATURE&cursor=&limit=100
```

| Query | 설명 |
|---|---|
| `bbox` | 지도 화면 범위 `minLng,minLat,maxLng,maxLat` (**경도 먼저**). 생략하면 지역 전체 |
| `category` | 유형 필터 |
| `cursor` | 이전 응답의 `nextCursor` |
| `limit` | 기본 100, 최대 200 |

```json
{
  "items": [
    {"attractionId": 5012, "name": "대릉원", "thumbnailUrl": "https://…", "category": "HISTORY_CULTURE", "lat": 35.838, "lng": 129.211, "recommendable": true}
  ],
  "nextCursor": null
}
```

- `recommendable: false` 핀은 흐리게 그리고 "코스에 추가" 버튼 비활성화
- `nextCursor`가 `null`이 아니면 다음 페이지가 있습니다
- 카카오맵 `bounds`에서 bbox 만들기: `${sw.getLng()},${sw.getLat()},${ne.getLng()},${ne.getLat()}`
- 오류: `400 ATTRACTION_INVALID_BOUNDS` (한국 범위 밖 등)

### GET `/attractions/{attractionId}` — 관광지 상세

```json
{
  "attractionId": 5012,
  "regionSigCd": "47130",
  "name": "대릉원",
  "category": "HISTORY_CULTURE",
  "address": "경북 경주시 황남동 …",
  "lat": 35.838, "lng": 129.211,
  "description": "…",
  "images": [{"url": "https://…", "sourceName": "한국관광공사", "license": null}],
  "useTime": "09:00~22:00",
  "restDate": "연중무휴",
  "estimatedDurationMinutes": 90,
  "estimated": true,
  "recommendable": true,
  "notRecommendableReasons": [],
  "sources": [{"name": "한국관광공사 TourAPI", "contentId": "126207", "fetchedAt": "2026-09-30T00:00:00"}]
}
```

- `images` → 이미지 캐러셀 (출처 `sourceName` 표기)
- `useTime`, `restDate`는 원문 문자열 그대로, 없으면 `null`
- `estimatedDurationMinutes`는 "약 90분" 같은 추정치
- 오류: `404 ATTRACTION_NOT_FOUND`

---

## 10. 여행기·사진 지도 (추가 기능, MVP 이후)

- **여행 종료일이 지난** 여행에 참여자마다 여행기 하나씩 (내 것만, 다른 참여자와 공유되지 않음)
- 사진 1~30장. 발행하면 내 지도에 핀으로 표시됩니다
- 사진 URL은 5분 후 만료되는 서명 URL이라 **캐시해 두지 말고** 화면 진입 때마다 새로 받아 주세요

### 응답 `Diary`

```json
{
  "diaryId": 31,
  "tripId": 42,
  "status": "DRAFT",
  "title": "비 오는 날의 경주",
  "body": "…",
  "courseTitle": "신라의 시간을 걷는 2일",
  "regionSigCd": "47130",
  "visitedFrom": "2026-10-10",
  "visitedTo": "2026-10-11",
  "visibility": "PRIVATE",
  "locationPrecision": "CITY",
  "satisfaction": 5,
  "experienceTags": ["역사", "산책"],
  "includeInTasteProfile": true,
  "coverPhotoId": 301,
  "photos": [{"photoId": 301, "url": "https://…", "thumbnailUrl": "https://…", "takenAt": "2026-10-10T14:03:00", "lat": 35.83, "lng": 129.21, "order": 0}],
  "publishedAt": null,
  "updatedAt": "2026-10-13T20:00:00"
}
```

| 필드 | 값 |
|---|---|
| `status` | `DRAFT` 초안 · `PUBLISHED` 발행 |
| `visibility` | `PRIVATE` 나만 · `FRIENDS` 친구 · `LINK` 링크 가진 사람 (기본 `PRIVATE`) |
| `locationPrecision` | 남에게 보이는 사진 위치: `EXACT` 정확히 · `CITY` 지역 중심으로 · `HIDDEN` 숨김 (기본 `CITY`) |
| `satisfaction` | 만족도 1~5 (선택) |
| `experienceTags` | 최대 5개 |
| `includeInTasteProfile` | 다음 추천에 이 여행 반영할지 (기본 `true`) |

### API

| API | 설명 |
|---|---|
| POST `/courses/{tripId}/diary` | 초안 만들기. body 없거나 `{"title": "..."}`. 제목 기본값은 코스 제목 → `201` `Diary` |
| POST `/diaries/{diaryId}/photos` | `multipart/form-data`, 파트 이름 `files` (여러 개). JPEG·PNG·WebP, 장당 10MB → `201` `{"photos": [...]}`. 하나라도 실패하면 전부 실패 |
| DELETE `/diaries/{diaryId}/photos/{photoId}` | `204`. 발행된 여행기의 마지막 사진은 못 지움 |
| PATCH `/diaries/{diaryId}` | 보낸 필드만 수정. `title`(1~60자), `body`(최대 5000자), `visibility`, `locationPrecision`, `satisfaction`, `experienceTags`, `includeInTasteProfile`, `coverPhotoId`, `photoOrder`(사진 id 전체를 원하는 순서로) → `200` `Diary` |
| POST `/diaries/{diaryId}/publish` | 발행 → `200` `Diary`. 제목·사진이 없으면 `422 DIARY_NOT_PUBLISHABLE` (`details.missing: ["TITLE","PHOTO"]`) |
| GET `/diaries/{diaryId}` | 조회 (작성자, 또는 `FRIENDS` 공개된 친구) |
| DELETE `/diaries/{diaryId}` | 삭제 `204` (초안·발행 모두) |

**사진 업로드 예시**

```js
const form = new FormData();
files.forEach(f => form.append('files', f));
await fetch(`${API}/api/diaries/${diaryId}/photos`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` }, // Content-Type은 직접 넣지 않기
  body: form,
  credentials: 'include',
});
```

### 여행 지도

**GET `/me/travel-map?from=&to=`** — 내 여행기 핀 (초안 포함)
**GET `/friends/{userId}/travel-map?from=&to=`** — 친구의 발행된 `FRIENDS` 공개 여행기만 (친구 아니면 `403 FRIEND_REQUIRED`)

```json
[
  {"diaryId": 31, "title": "비 오는 날의 경주", "courseTitle": "신라의 시간을 걷는 2일", "coverPhotoUrl": "https://…",
   "visitedAt": "2026-10-10", "lat": 35.856, "lng": 129.225, "locationPrecision": "CITY", "visibility": "FRIENDS", "status": "PUBLISHED"}
]
```

`coverPhotoUrl`이 `null`이면 기본 이미지를 보여주세요.

### 여행기 공유 링크

| API | 설명 |
|---|---|
| POST `/diaries/{diaryId}/share-links` | `{"expiresInDays": 7}` → `201` `{"id", "token": "dl_...", "expiresAt", "createdAt"}`. **발행됐고 `visibility: LINK`일 때만** 가능 (아니면 `422`, `details.missing`) |
| GET `/diaries/{diaryId}/share-links` | 목록 `{id, expiresAt, revoked, createdAt}[]` |
| DELETE `/diaries/{diaryId}/share-links/{linkId}` | 폐기 `204` |
| GET `/shared/diaries/{token}` | 링크 열기. 코스 공유와 같은 방식 (쿠키 발급 → 303 → JSON) |
| GET `/shared/diaries` | 공유된 여행기 `Diary` |

---

## 11. 오류 코드 → 화면 처리 모음

| code | HTTP | 추천 처리 |
|---|---:|---|
| `AUTH_UNAUTHENTICATED` | 401 | refresh 1회 → 재시도, 실패 시 로그인 |
| `AUTH_INVALID_REFRESH_TOKEN` | 401 | 로그인 화면 |
| `AUTH_INVALID_CREDENTIALS` | 401 | "이메일 또는 비밀번호가 올바르지 않습니다" |
| `AUTH_DUPLICATE_EMAIL` | 409 | 이메일 필드 오류 표시 |
| `ONBOARDING_REQUIRED` | 409 | 온보딩 화면으로 |
| `ONBOARDING_INVALID_QUESTION_VERSION` | 400 | 문항 다시 받아 재시작 |
| `TRIP_NOT_FOUND` | 404 | "여행을 찾을 수 없어요" → 목록으로 |
| `TRIP_DATE_OVERLAP` | 409 | `details.conflicts`로 겹치는 여행 표시 |
| `TRIP_VERSION_CONFLICT` | 409 | "다른 참여자가 먼저 수정했어요" → 코스 다시 조회 |
| `TRIP_CONTEXT_LOCKED` | 409 | "코스를 비우고 다시 만들어요" 확인 → `replaceCourse: true` |
| `TRIP_ENDED` | 409 | 읽기 전용 모드로 전환 |
| `TRIP_FULL` | 409 | "참여 인원(8명)이 꽉 찼어요" |
| `TRIP_REGION_NOT_SELECTED` | 409 | 지역 정하기 화면으로 |
| `COURSE_NOT_FOUND` | 404 | 코스 만들기 화면으로 |
| `COURSE_CREATOR_ONLY` | 403 | "만든 사람이 코스를 먼저 만들어야 해요" |
| `COURSE_INSUFFICIENT_CANDIDATES` | 422 | 지역 변경 유도 |
| `COURSE_RESTAURANT_SELECTION_INVALID` | 422 | 식당 목록 다시 받기 |
| `COURSE_KAKAO_LOCAL_UNAVAILABLE` / `_RATE_LIMITED` | 502/503 | "잠시 후 다시 시도해 주세요" |
| `ATTRACTION_ALREADY_IN_COURSE` | 409 | "이미 일정에 있는 장소예요" |
| `DRAW_NO_ELIGIBLE_REGION` | 422 | "조건에 맞는 지역이 없어요" |
| `DRAW_REGION_NOT_ELIGIBLE` | 422 | "이 지역은 이 일정으로 코스를 만들 수 없어요" |
| `INVITE_EXPIRED` / `INVITE_REVOKED` | 410 | "만료된 초대 링크예요" |
| `INVITE_ALREADY_HANDLED` | 409 | 목록 새로고침 |
| `SHARE_SESSION_INVALID`, `SHARE_LINK_*` | 401/404/410 | "더 이상 열 수 없는 링크예요" |
| `FRIEND_LINK_SELF` | 400 | "내가 만든 링크예요" |
| `FRIEND_LINK_EXPIRED` / `_REVOKED` | 410 | "만료된 링크예요" |
| `TOKEN_AUDIENCE_MISMATCH` | 400 | 잘못된 링크 (다른 종류의 링크) |
| `INVALID_EXPIRES_IN_DAYS` | 400 | 유효기간 1~30일 |
