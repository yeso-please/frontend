# TriPin 앱 구조

React Native(Expo SDK 57, RN 0.86, New Architecture) Android 앱입니다. API 규약은 [frontend-api-guide.md](frontend-api-guide.md), 디자인은 피그마 "디자인 (초안)" 섹션(`398:983`)이 기준입니다.

## 범위

피그마 "디자인 (초안)"에 있는 화면까지만 만듭니다. 디자인이 없는 화면(여행 탭 목록, 저장 탭, 로그인·회원가입, 코스 화면)은 토큰만 맞춘 기본 화면이나 자리만 둡니다.

## 흐름 (2026-10-09 결정)

```text
로그인/회원가입 ─→ 온보딩(AI Hub 설문: 여행 스타일 → 여행 동기 → 좋아하는 지역 → 여행 방식) ─→ 분석 중 ─→ 홈 탭
홈: 랜덤 핀 꽂기 → 핀 떨어지는 중 → 여행지 발견(시트) ⇄ 자세히(시트 펼침) → "OO으로 여행 만들기"
  → 여행 준비(A) → 날짜 선택(C, POST /trips + POST /trips/{id}/region MANUAL) → 친구 초대(D) → 여행(코스 화면, 미디자인)
MY 탭: 여행 MBTI 검사(S1 질문 12개 → S2 경험 태그·제외 조건 → S3 분석 → B 결과). 앱 안에서만 계산하고 서버에 보내지 않습니다.
```

- **핀 먼저:** 홈에서 앱이 `GET /regions?days=1`의 추첨 가능 지역 중 하나를 고릅니다. 여행을 만든 뒤 `POST /trips/{id}/region`에 `mode: "MANUAL"`로 저장합니다. 고른 지역이 감당 못 하는 긴 일정은 날짜 화면에서 막습니다(`GET /regions?days=N`).
- **온보딩:** 백엔드 `aihub-traveler-v1` 설문입니다. 피그마 402px 온보딩(성별 제외)을 디자인 토큰으로 맞춰 구현합니다. 성별은 서버 필드가 없어 받지 않습니다.
- **MBTI:** 디자이너 메모 "MY → mbti 검사". 구형 `demo-mbti-v1`으로 제출하면 최신 온보딩을 덮어쓰므로 **절대 서버에 제출하지 않습니다.**

## 폴더

```text
src/
  app/                 expo-router 라우트 (파일 = 화면)
    (auth)/            로그인·회원가입
    onboarding/        취향 온보딩
    (tabs)/            홈·여행·저장·MY 탭
    trip/              여행 준비 흐름 (prepare, dates, [tripId]/invite, [tripId])
    my/mbti/           여행 MBTI 검사
  api/                 client(토큰 재발급 single-flight), endpoints, types, queryKeys, mock(목업 서버)
  components/ui/       공통 UI (AppText, Button, PressableScale, TopBar, BottomCTA, ProgressBar, Chip, StateViews)
  components/icons.ts  피그마 SVG 아이콘
  features/<기능>/      기능별 컴포넌트·훅·데이터
  store/               zustand (auth, tripDraft)
  theme/               피그마 토큰 (colors, typography, layout, motion)
  lib/                 haptics, date, mapProjection
assets/icons           피그마에서 내보낸 SVG
assets/illustrations   한국 지도(WebP), MBTI 캐릭터 16종
```

## 규칙

- **색·글꼴·간격:** 숫자를 직접 쓰지 말고 `@/theme` 토큰을 씁니다. 새 값이 필요하면 토큰에 이름을 붙여 추가합니다.
- **텍스트:** `AppText variant`만 씁니다. Android는 굵기를 `fontFamily`로 지정해야 해서 `fontWeight`를 쓰지 않습니다.
- **탭 가능한 요소:** `PressableScale`(스프링 축소 + 햅틱)을 씁니다. 터치 영역은 44 이상입니다.
- **애니메이션:** Reanimated 4를 씁니다. transform·opacity 위주로 움직이고 width·height 애니메이션은 피합니다.
  - 등장: `entering={FadeInDown.delay(i * motion.stagger).springify()}`
  - 스프링·타이밍 값: `motion.spring.*`, `motion.timing.*`
- **서버 데이터:** TanStack Query와 `queryKeys`를 씁니다.
  - 오류 분기는 `isApiError(e, "CODE")`처럼 `code`로 합니다.
  - 목록 화면은 Loading / Empty / Error 상태를 반드시 둡니다(`StateViews`).
- **화면 간 임시 상태:** zustand를 씁니다(`useTripDraft`).
- **목업:** `.env.local`에 `EXPO_PUBLIC_API_MOCK=true`를 두면 `src/api/mock/server.ts`가 백엔드 대신 응답합니다.
  - 데모 계정: `demo@tripin.app` / `tripin1234`
  - 새 API를 쓰면 목업에도 같은 모양으로 추가합니다.
- **코드 스타일 (노션 컨벤션):** 쌍따옴표, 세미콜론, camelCase.
- **커밋:** `feat: …`, `fix: …`, `docs: …`. 한 커밋에 한 가지 문제만 담습니다.

## 실행

```bash
npm install
cp .env.example .env.local
npm run android      # 첫 실행: 네이티브 빌드 후 기기에 설치
npm start            # 이후에는 Metro만 띄우면 됩니다
```

- **JDK:** 21을 씁니다. `JAVA_HOME`이 25면 빌드 전에 21로 바꿉니다.
- **프로젝트 경로:** 한글·공백이 없는 경로에 둡니다(예: `C:\dev\tripin\frontend`). 한글 경로에서는 Gradle 빌드가 깨집니다.
- **USB 실기기에서 로컬 백엔드 쓰기:** 아래 명령을 실행한 뒤 `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api`를 씁니다.

```bash
adb reverse tcp:8080 tcp:8080
```
