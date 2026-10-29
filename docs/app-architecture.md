# TriPin 앱 구조

React Native(Expo SDK 57, RN 0.86, New Architecture) Android 앱입니다.

- **디자인 기준:** 피그마 `IvlST03u2P3Un9OTjUSyBk`의 디자이너 수정본 **"초안" 섹션(`502:2696`)**이 1순위입니다. 그 밖은 확정 디자인 프레임(`489:4621`)을 따릅니다.
- **화면별 API:** 백엔드 `docs/frontend-guide.md`가 정리합니다. API 계약은 백엔드 `docs/api/`가 기준이고, 요약은 [frontend-api-guide.md](frontend-api-guide.md)에 있습니다.

## 범위 (2026-10-22)

확정 디자인과 초안의 A~F 화면, MY(M1·M2)를 만듭니다.

- **하단 탭:** 홈·여행·내 코스·MY입니다. 내 코스는 피그마 "추가 화면" 01이고, 저장 탭은 이번 범위에서 뺍니다(백엔드 D14).
- **디자인이 없는 화면:** 식당 고르기, 코스 경로 지도, 받은 초대 목록, 친구 초대 링크 수락은 같은 화면 언어로 만들었습니다.
- **친구의 여행 성향(초안 M2·M3):** 백엔드가 다른 회원의 MBTI를 주지 않아 닉네임만 보여 줍니다. 백엔드 요청 메모를 남겼습니다.

## 흐름 (지역 먼저, 백엔드 D1)

```text
로그인/회원가입/카카오 ─→ 취향 설문(한 페이지 스크롤) ─→ 분석 중 ─→ 나의 여행 성향(C6) ─→ 여행 탭
여행 탭: 핀 꽂기(POST /regions/draw) → 지역 발견 시트(B3) → 지역 추천(B4: 대표 사진·맞춤 문장·만나볼 순간)
  → 날짜(C7, POST /trips/context/check sigCd → POST /trips regionSigCd) → 친구 초대(D1) → 함께 만드는 코스(E0 생성 → E1)
코스: 전체 보기 ⇄ 변경 표시, 일차 탭, 카드 드래그 순서 변경(MOVE), 장소 편집(F1: 지도 + 대체 후보 → REPLACE/REMOVE, 장소 정보 7-4),
  장소 추가(날마다 '+ 이 날에 장소 추가' → 지도를 움직이면 그 범위 관광지 핀 7-3·추천 5-4 → 장소 정보 7-4 → ADD),
  식사 식당 고르기(SET_RESTAURANT), 코스 지도(5-7 경로), 참여자 관리(E3 내보내기·나가기), "○○가 보고 있어요"(20초 신호)
홈 탭: 준비 중인 여행 카드(가로 넘김, 준비 단계 칩) / 새 여행, 나의 여행 성향, 벨 = 받은 초대 수
초대 받기: 벨 → 받은 초대(D2a) / 링크 tripin://invite/{token}(D2b, 로그인 전에도) → 참여 완료(D2c), 둘러보기(E4)
내 코스 탭: 다가오는·지난 여행 전체(3-6 period 없이) → 전체/짜는 중(코스 전)/완성(코스 있음)/다녀옴 → 이어서 짜기·코스 보기·여행기 쓰기
MY: 프로필·성향·친구(M1), 친구 목록(M2), 친구 초대 링크 보내기·보낸 링크 취소(2-4~2-6)
공유·초대 링크: 코스 화면 공유 버튼 → 읽기 전용 코스 링크(4-9~4-11) / 여행 초대 화면·여행기·MY에서 보낸 링크 목록과 취소(4-2·4-3, 6-9·6-10, 2-5·2-6)
  받은 링크: course/{token}(4-12·4-13, 로그인 없이 읽기 전용·참여자 이름 감춤), invite·friend·diary-link/{token}
여행기: 나의 여행 지도(6-7, 발표 자료 화면) → 기록할 여행 "여행기 쓰기"(6-1) → 사진·제목·이야기·만족도·경험 태그·공개 범위(6-2~6-4) → 발행(6-5)
  친구 여행 지도(6-8, 친구 목록 "···"), 링크 공개 여행기 공유(6-9, tripin://diary-link/{token} → 6-11·6-12, 로그인 없이 열림)
```

- **설문:** 백엔드 `aihub-traveler-v2`입니다. 한 페이지에서 순서대로 묻습니다.
  - 여행 스타일 4문항: 5단 슬라이더이고 서버에는 1·3·4·5·7로 보냅니다.
  - 여행 MBTI 12문항: 두 선택지 카드입니다.
  - 여행 동기: 최대 3개입니다. 코드 5는 화면에서만 "사진 남기기"로 표시합니다.
  - 일정 밀도(`scheduleDensity`)는 보내지 않습니다. 서버가 MBTI J/P로 정합니다.
- **성향 콘텐츠:** 백엔드 `travel-personas.json`을 `src/features/mbti/travel-personas.json`으로 복사해 프론트 상수로 씁니다(D4). 문구를 바꾸면 백엔드 파일도 함께 바꿉니다. 캐릭터는 피그마에서 받은 16유형 그림을 씁니다.
- **지역 뽑기:**
  - 서버 `POST /regions/draw`(RANDOM, 또는 CONDITIONAL MY_TASTE)를 씁니다. 거리 조건은 위치 권한 패키지가 없어 아직 뺐습니다.
  - 결과의 `maxNights`로 날짜 화면에서 긴 일정을 막습니다.
  - 지도에서 직접 고르면 `MANUAL`입니다.
- **코스 생성:**
  - `tasteMode`를 보내지 않습니다. B4·E0의 "내 여행 성향 반영 / 완전 랜덤"은 `/me/preferences`를 바꿉니다.
  - 최초 생성은 여행을 만든 사람만 합니다(`COURSE_CREATOR_ONLY`).
- **여행기:**
  - 끝난 여행(오늘보다 종료일이 앞선 여행, 사후 기록 포함)에만 씁니다. 여행기를 만들면 그 여행의 코스는 읽기 전용이 됩니다.
  - 사진은 expo-image-picker로 고르고 multipart로 올립니다. 다시 압축하지 않아(quality 1) 촬영 위치(EXIF)가 남고, 서버가 위치만 뽑은 뒤 EXIF를 지웁니다. JPEG·PNG·WebP, 장당 10MB, 여행기마다 30장.
  - 사진 저장소(S3)는 AWS 서버에만 켜져 있습니다. 로컬 백엔드에서는 사진 API가 503입니다.
  - 백엔드 3-6 `myDiaryId`가 아직 비어 있어, 지도 핀(6-7)의 여행기를 조회해 여행과 맞춥니다(`useDiaryIdsByTrip`).
- **카카오 로그인:**
  - 백엔드는 웹 리다이렉트 방식(`POST /auth/kakao {code, redirectUri}`)만 지원합니다.
  - 앱은 카카오 인가 페이지를 웹뷰로 열고, 등록된 redirect URI로 이동하는 순간 `code`를 가로채 서버에 보냅니다. `state`로 CSRF를 막습니다.

## 폴더

```text
src/
  app/                 expo-router 라우트 (파일 = 화면)
    (auth)/            로그인·회원가입·카카오 웹뷰
    onboarding/, survey.tsx   첫 설문 / 성향검사 다시하기
    (tabs)/            홈(index)·여행(travel)·내 코스(courses)·MY(my)
    region/[sigCd]     B4 지역 추천
    trip/              dates(C7), [tripId]/ index(코스)·invite(D1)·joined(D2c)·participants(E3)·place/[itemId](F1)·add(장소 추가)·meal/[itemId]·map
    invites/           받은 초대 목록·D2a        invite/[token]/  D2b·E4 둘러보기 (로그인 없이 열림)
    friend/[token]     친구 초대 링크 수락 (로그인 없이 열림)
    diary/[diaryId]/   여행기 보기(index)·쓰기(edit)        diary-link/[token]  공유 여행기 (로그인 없이 열림)
    course/[token]     공유 코스 (로그인 없이 열림, 읽기 전용)
    my/                persona(C6)·friends(M2)·friend-links(보낸 친구 초대 링크)·travel-map(나의 여행 지도)·friend-map/[userId]
  api/                 client(토큰 재발급 single-flight, timeoutMs), endpoints, types, queryKeys, mock(목업 서버)
  components/ui/       공통 UI (AppText, Button, PressableScale, TopBar, BottomCTA, ProgressBar, Chip, StateViews)
  features/
    home/              A1·A2 홈 대시보드          discover/   B1~B4 지도·핀·지역 추천
    onboarding/, mbti/ 설문·성향 결과             trip/       날짜·초대·준비 단계
    course/            코스 화면·카드·드래그·접속 표시 (useCourse, useCourseEdit, format)
    place/             F1 장소 편집·장소 추가·식사·관광지 정보   kakaoMap/   카카오맵 웹뷰 컴포넌트
    share/             보낸 링크 목록·취소, 코스 공유 시트
    invites/           받은 초대·초대 수신 화면    auth/       카카오 로그인
    diary/             여행기·여행 지도 (TravelMapCanvas, DiaryBody, 편집 화면)
  store/               zustand (auth, tripDraft, pendingInvite)
  theme/               피그마 토큰 (colors, typography, layout, motion)
  lib/                 haptics, date, josa, mapProjection, imageUrl
assets/illustrations   3D 지형 지도(korea-terrain.webp, 489:1492 3배·배경 투명), MBTI 캐릭터 16종
```

## 규칙

- **색·글꼴·간격:** 숫자를 직접 쓰지 말고 `@/theme` 토큰을 씁니다. 새 값이 필요하면 토큰에 이름을 붙여 추가합니다.
- **텍스트:** `AppText variant`만 씁니다. Android는 굵기를 `fontFamily`로 지정해야 해서 `fontWeight`를 쓰지 않습니다.
- **탭 가능한 요소:** `PressableScale`(스프링 축소 + 햅틱)을 씁니다. 터치 영역은 44 이상입니다.
- **애니메이션:** Reanimated 4를 씁니다. transform·opacity 위주로 움직이고 width·height 애니메이션은 피합니다.
  - `transformOrigin` 퍼센트는 정수로 씁니다. `"95.83333%"` 같은 긴 소수는 안드로이드에서 파싱에 실패해 뷰가 그려지지 않습니다.
  - 애니메이션 스타일에서 키를 빼면 이전 값이 남습니다. 그림자 같은 값은 되돌리는 값을 직접 넣습니다.
- **원격 이미지:** 항상 `secureImageUrl()`을 거칩니다. 관광공사 이미지가 `http://`로 오는데, 릴리스 빌드는 평문 HTTP를 막습니다.
- **서버 데이터:** TanStack Query와 `queryKeys`를 씁니다.
  - 오류 분기는 `isApiError(e, "CODE")`처럼 `code`로 합니다.
  - 목록 화면은 Loading / Empty / Error 상태를 반드시 둡니다(`StateViews`).
  - 코스 편집은 `useCourseEdit`을 씁니다. `version`을 보내고, 409면 다시 받습니다.
- **화면 간 임시 상태:** zustand를 씁니다.
  - `useTripDraft`: 뽑은 지역 → 날짜 → 만든 여행.
  - `usePendingInvite`: 로그인 전에 연 초대 링크.
- **목업:** `.env.local`에 `EXPO_PUBLIC_API_MOCK=true`를 두면 `src/api/mock/`이 백엔드 대신 응답합니다.
  - 지역 추첨, 코스 생성·편집, 초대, 접속 표시까지 같은 계약입니다.
  - 데모 계정: `demo@tripin.app` / `tripin1234`
  - 새 API를 쓰면 목업에도 같은 모양으로 추가합니다.
- **코드 스타일 (노션 컨벤션):** 쌍따옴표, 세미콜론, camelCase.
- **커밋:** `feat: …`, `fix: …`, `docs: …`. 한 커밋에 한 가지 문제만 담습니다.

## 테스트

```bash
npm run typecheck   # 앱 + 테스트 타입 검사
npm run lint
npm test            # Jest (tests/): 설문 값 변환, 준비 단계, 코스 포맷·순서 변경, 지도 투영·배치, 카카오맵 HTML,
                    # API 클라이언트 토큰 재발급, 목업 API 계약(추첨·코스 편집·초대·친구 링크·여행기), 내 코스 상태
                    # tests/components: 화면 컴포넌트(React Native Testing Library) — 버튼·태그·세그먼트, 여행기 본문, 여행 지도 핀
npm run test:perf:baseline  # Reassure: 렌더 시간·횟수 기준 저장 (tests/perf, 결과는 .reassure/)
npm run test:perf           # Reassure: 바꾼 코드를 기준과 비교
npm run test:e2e            # Maestro: 실제 폰에서 흐름 확인 (.maestro/README.md)
npx expo-doctor
```

| 도구 | 쓰는 곳 | 메모 |
|---|---|---|
| [React Native Testing Library](https://github.com/callstack/react-native-testing-library) 14 | `tests/components` | `render`·`fireEvent`가 async입니다. 접근성 역할·라벨로 찾습니다. Reanimated·worklets·안전 영역은 `tests/setup.ts`에서 라이브러리 모의 객체로 바꿉니다 |
| [Reassure](https://github.com/callstack/reassure) | `tests/perf/*.perf-test.tsx` | 핀 30개 여행 지도 약 19ms·렌더 2번, 사진 30장 여행기 약 16ms·렌더 1번 (2026-10-28 기준) |
| [Maestro](https://github.com/mobile-dev-inc/Maestro) | `.maestro/` | 로그인된 앱에서 시작합니다. Maestro는 adb 서버를 5037에서만 찾습니다 |
| [Flashlight](https://github.com/bamlab/flashlight) | `.maestro/perf/` | 릴리스 빌드에서 Maestro 흐름을 여러 번 돌려 FPS·CPU·메모리를 잽니다 |

## 공유 링크 주소

- 서버가 https(AWS)면 `https://<public_url>/{invite|friend|course|diary-link}/{token}`을 보냅니다(`shareUrl`). 카카오톡에서 `tripin://`은 눌리지 않기 때문입니다.
- 이 주소는 infra 레포 `site/`의 안내 페이지가 받아, 안드로이드에서 앱(`tripin://…`)을 열고 앱이 없으면 앱 받기로 보냅니다. 코스·여행기 공유 링크는 앱 없이도 웹에서 읽기 전용으로 보여 줍니다.
- 로컬·목업 서버면 `tripin://…`을 그대로 씁니다.

## APK 배포

main에 앱 코드(`src/`·`assets/`·`app.json`·`package*.json`)가 들어오면 `.github/workflows/release-apk.yml`이 테스트 → 릴리스 APK 빌드(AWS 서버 주소) → `https://dn77qbtivmjzt.cloudfront.net/download/tripin.apk` 업로드를 합니다.

- AWS 권한은 레포 변수 `AWS_APP_RELEASE_ROLE_ARN`의 OIDC 역할로 받습니다. 업로드·캐시 비우기만 됩니다(infra `app_release`).
- 카카오 키는 SSM `/tripin/dev/deploy/APP_KAKAO_*`에서 읽습니다. 바꾸려면 infra `scripts/put-app-keys.ps1`을 다시 실행하고 Actions에서 "Release APK"를 다시 돌립니다.
- 기본은 arm64-v8a만 넣습니다. 옛 폰용이 필요하면 Actions에서 직접 실행할 때 `arm64-v8a,armeabi-v7a`를 넣습니다.
- 지금은 공개 디버그 키로 서명합니다(팀 테스트용).

## 폰트

Noto Sans KR은 쓰는 굵기 3개(400/500/700)만 씁니다. 한글 완성형·자모·영문·기호만 남긴 서브셋을 `assets/fonts`에 둡니다(OFL, 굵기당 약 2.7MB). `@expo-google-fonts/noto-sans-kr` 패키지 index를 import하면 9개 굵기(약 53MB)가 모두 앱에 들어가므로 쓰지 않습니다.

## 실행

```bash
npm install
cp .env.example .env.local
npm run android      # 첫 실행: 네이티브 빌드 후 기기에 설치
npm start            # 이후에는 Metro만 띄우면 됩니다
```

- **JDK:** 21을 씁니다. `JAVA_HOME`이 25면 빌드 전에 21로 바꿉니다.
- **프로젝트 경로:** 한글·공백이 없는 경로에 둡니다(예: `C:\dev\tripin\frontend`). 한글 경로에서는 Gradle 빌드가 깨집니다.
- **실기기에서 로컬 백엔드 쓰기:** 아래 명령을 실행한 뒤 `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api`를 씁니다.
  - 로컬 백엔드를 개발 RDS(`dev-rds` 프로필)로 띄울 때는 refresh 쿠키의 `Secure`를 꺼야 합니다(`APP_AUTH_COOKIE_SECURE=false`).
  - 끄지 않으면 http에서 쿠키가 저장되지 않아, 앱을 다시 켤 때 로그인이 풀립니다.
- **adb 서버 충돌:** LDPlayer 같은 에뮬레이터가 자기 adb(다른 버전)로 5037 포트를 쓰면 무선 연결이 계속 끊깁니다. 이때는 `ANDROID_ADB_SERVER_PORT=5038`처럼 다른 포트에서 adb 서버를 띄웁니다.
- **카카오맵 웹뷰:**
  - `EXPO_PUBLIC_KAKAO_JS_KEY`와 `EXPO_PUBLIC_KAKAO_MAP_ORIGIN`이 필요합니다.
  - origin은 카카오 디벨로퍼스 앱 > 플랫폼 > Web 도메인에 등록된 주소여야 합니다. 2026-10-22 기준 `http://localhost:8080`이 등록돼 있고, 5173은 미등록이라 401 `domain mismatched`가 납니다. AWS CloudFront 주소(`https://dn77qbtivmjzt.cloudfront.net`)도 2026-10-29 기준 미등록(401)이라 AWS용 빌드도 origin은 localhost:8080을 씁니다.
  - 이 출처에서는 카카오 SDK가 지도 타일을 http로 받습니다. 릴리스 빌드는 `plugins/withKakaoMapCleartext.js`로 카카오 도메인에만 평문 HTTP를 허용합니다. https 도메인을 등록하고 origin을 바꾸면 이 우회는 빼도 됩니다.

```bash
adb reverse tcp:8080 tcp:8080
adb reverse tcp:8081 tcp:8081
```
