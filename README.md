<p align="center">
  <img src="assets/images/icon.png" width="112" alt="TriPin 앱 아이콘" />
</p>

<h1 align="center">TriPin</h1>

<p align="center">
  <b>우연이 만든 최고의 여행</b><br />
  지도에 핀을 꽂아 국내 여행지를 발견하고, 취향에 맞춘 코스를 친구와 함께 만드는 안드로이드 앱
</p>

<p align="center">
  <a href="https://dn77qbtivmjzt.cloudfront.net/download/"><b>📲 앱 받기 (Android APK)</b></a>
  &nbsp;·&nbsp;
  <a href="docs/app-architecture.md">앱 구조</a>
  &nbsp;·&nbsp;
  <a href="docs/frontend-api-guide.md">API 요약</a>
</p>

<p align="center">
  <img alt="Expo SDK 57" src="https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white" />
  <img alt="React Native 0.86" src="https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" />
  <img alt="Android 7.0+" src="https://img.shields.io/badge/Android-7.0%2B-3DDC84?logo=android&logoColor=white" />
</p>

---

## 목차

- [소개](#소개)
- [주요 기능](#주요-기능)
- [앱 설치하기](#앱-설치하기)
- [기술 스택](#기술-스택)
- [개발 시작하기](#개발-시작하기)
- [스크립트](#스크립트)
- [프로젝트 구조](#프로젝트-구조)
- [테스트](#테스트)
- [배포](#배포)
- [문제 해결](#문제-해결)
- [개발 규칙](#개발-규칙)
- [관련 저장소](#관련-저장소)

## 소개

여행지를 정하는 데 시간을 다 쓰는 대신, **지도에 핀을 꽂아 우연히 고른 지역**으로 떠나 보는 앱입니다.

1. 짧은 취향 설문으로 나의 **여행 성향**(16가지 캐릭터)을 알아봅니다.
2. 지도에 핀을 꽂으면 무작위로, 또는 내 취향에 맞춰 **여행지가 뽑힙니다**.
3. 날짜를 정하고 친구를 초대하면, 모두의 취향을 반영한 **추천 코스**가 만들어지고 함께 고칩니다.
4. 다녀온 뒤에는 사진과 이야기로 **여행기**를 남기고, 사진을 찍은 곳이 **나의 여행 지도**에 핀으로 쌓입니다.

이 저장소는 TriPin의 **안드로이드 앱(React Native)** 입니다. 서버·추천 모델·클라우드 설정은 [관련 저장소](#관련-저장소)에 있습니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| **취향 설문 · 여행 성향** | 여행 스타일 4문항, 여행 MBTI 12문항, 여행 동기(최대 3개)를 한 페이지에서 답합니다. 결과로 16가지 여행 성향 캐릭터 중 하나를 보여 줍니다. |
| **핀 꽂기로 여행지 발견** | 3D 지형 지도에 핀을 꽂으면 지역이 뽑힙니다(완전 랜덤 / 내 취향). 지도에서 직접 고를 수도 있습니다. 뽑힌 지역은 대표 사진, 맞춤 문장, "만나볼 순간"으로 소개합니다. |
| **일정 · 친구 초대** | 달력에서 날짜를 정하고 초대 링크를 카카오톡 등으로 보냅니다. 받은 사람은 로그인 전에도 링크를 열 수 있습니다. 받은 초대는 홈의 벨에 모입니다. |
| **함께 만드는 코스** | 일차별 장소 카드로 코스를 보여 줍니다. 할 수 있는 일:<br/>· 카드를 끌어 순서 바꾸기<br/>· 장소 바꾸기·빼기, 지도를 움직이며 **장소 추가**<br/>· 식사 자리에 식당 고르기<br/>· 이동 경로 지도 보기<br/>· 관광지 정보(사진·소개·이용 시간·휴무일) 보기<br/><br/>지금 누가 같은 코스를 보고 있는지 표시하고, 동시에 고쳐서 충돌하면 최신 코스로 다시 맞춥니다. |
| **코스 공유** | 여행에 참여하지 않은 사람에게 **로그인 없이 읽기 전용**으로 보여 주는 링크를 보냅니다. 함께하는 사람의 이름은 가립니다. 앱이 없으면 웹 페이지로 열리고, 보낸 링크는 언제든 취소할 수 있습니다. |
| **내 코스** | 다가오는 여행과 지난 여행 전체를 짜는 중 / 완성 / 다녀옴으로 나눠 보고, 이어서 짜기·코스 보기·여행기 쓰기로 바로 갑니다. |
| **여행기** | 끝난 여행에 사진(최대 30장), 만족도, 경험 태그, 이야기를 남깁니다. 공개 범위는 나만 / 친구 / 링크 중에서 고릅니다. 사진의 촬영 위치는 다른 사람에게 보일 정밀도를 지역만 / 정확히 / 숨김 중에서 정합니다. |
| **나의 여행 지도 · 친구** | 발행한 여행기가 지도에 핀으로 모입니다. 친구 초대 링크로 친구를 맺으면 친구의 여행 지도도 볼 수 있습니다. 보낸 초대·공유 링크는 MY와 각 화면에서 모아 보고 취소합니다. |

## 앱 설치하기

> 지금은 **팀 테스트용 APK**로 배포합니다. Google Play에는 아직 올리지 않았고, iOS 버전은 없습니다.

### 다운로드

**👉 [https://dn77qbtivmjzt.cloudfront.net/download/](https://dn77qbtivmjzt.cloudfront.net/download/)**

폰의 브라우저(Chrome·삼성 인터넷)에서 위 주소를 열고 **APK 내려받기**를 누릅니다. 파일만 바로 받으려면 [`tripin.apk`](https://dn77qbtivmjzt.cloudfront.net/download/tripin.apk)(약 50MB)를 엽니다.

### 설치 순서

1. 받은 `tripin.apk`를 알림창이나 "내 파일 > 다운로드"에서 엽니다.
2. "출처를 알 수 없는 앱" 안내가 나오면 **설정 → 이 출처 허용**을 켜고 돌아옵니다.
3. **설치**를 누릅니다. Play 프로텍트 경고가 나오면 안내에 따라 설치를 계속합니다. 스토어를 거치지 않은 팀 테스트용 앱이라 나오는 안내입니다.
4. 홈 화면이나 앱 서랍의 **TriPin**을 열고 회원가입 또는 로그인합니다.

### 필요한 환경

| 항목 | 조건 |
|---|---|
| OS | Android 7.0 (API 24) 이상 |
| CPU | 64비트 ARM(arm64-v8a). 2017년 이후 나온 폰은 대부분 해당합니다. |
| 네트워크 | 인터넷 연결 필요 (지도·코스·사진을 서버에서 받습니다) |

### 업데이트

`main`에 앱 코드가 올라갈 때마다 같은 주소의 APK가 새 버전으로 바뀝니다. 새 APK를 받아 그대로 설치하면 **데이터와 로그인이 유지된 채** 업데이트됩니다.

### 공유 링크로 열기

친구가 보낸 링크(`…/invite/…`, `/friend/…`, `/course/…`, `/diary-link/…`)를 누르면 안내 페이지가 앱을 엽니다. 앱이 없으면 앱 받기로 보냅니다. **코스와 여행기 공유 링크는 앱이 없어도 웹에서 바로 볼 수 있습니다.**

## 기술 스택

| 분류 | 사용 |
|---|---|
| 프레임워크 | [Expo](https://docs.expo.dev/) SDK 57 (dev client, prebuild), React Native 0.86 (New Architecture), React 19, TypeScript |
| 라우팅 | [expo-router](https://docs.expo.dev/router/introduction/): 파일 기반, typed routes, `Stack.Protected`로 로그인 분기 |
| 서버 상태 | [TanStack Query](https://tanstack.com/query) v5 + 직접 만든 fetch 클라이언트(토큰 재발급 single-flight, 타임아웃) |
| 앱 상태 | [zustand](https://github.com/pmndrs/zustand) (로그인, 여행 만들기 임시값, 로그인 전 초대 링크) |
| 애니메이션 · 제스처 | Reanimated 4, Gesture Handler, [@gorhom/bottom-sheet](https://github.com/gorhom/react-native-bottom-sheet) |
| 목록 · 달력 | [FlashList](https://github.com/Shopify/flash-list) 2, [Flash Calendar](https://github.com/MarceloPrado/flash-calendar) |
| 지도 | 카카오맵 JavaScript SDK (WebView), 직접 그린 3D 지형 지도 |
| 미디어 | expo-image, expo-image-picker, expo-file-system (사진 multipart 업로드) |
| 보안 저장 | expo-secure-store (refresh 토큰) |
| 기타 | react-native-svg(+ svg transformer), sonner-native(토스트), expo-haptics, expo-linear-gradient |
| 테스트 | Jest(jest-expo), [React Native Testing Library](https://github.com/callstack/react-native-testing-library), [Reassure](https://github.com/callstack/reassure), [Maestro](https://github.com/mobile-dev-inc/Maestro), [Flashlight](https://github.com/bamlab/flashlight) |
| CI/CD | GitHub Actions → AWS(OIDC) → S3 + CloudFront |

## 개발 시작하기

### 준비물

- **Node.js** 22 이상 (24 LTS 권장)
- **JDK 21**: `JAVA_HOME`을 JDK 21로 지정합니다. JDK 25에서는 빌드가 실패합니다.
- **Android SDK**: `ANDROID_HOME` 환경 변수를 설정합니다.
- **실행 기기**: USB 또는 무선 디버깅을 켠 안드로이드 폰, 또는 에뮬레이터
- **프로젝트 경로**: 한글·공백이 없는 곳에 clone합니다(예: `C:\dev\tripin\frontend`). 한글 경로에서는 Android Gradle 빌드가 깨집니다.

### 설치와 실행

```bash
git clone https://github.com/yeso-please/frontend.git
cd frontend
npm install
cp .env.example .env.local
npm run android   # 처음 한 번: 네이티브 빌드 후 기기에 설치
npm start         # 이후에는 Metro 개발 서버만 띄우면 됩니다
```

`android/` 폴더는 `expo prebuild`가 만드는 생성물이라 git에 올리지 않습니다. 네이티브 설정은 `app.json`과 `plugins/`에서 바꿉니다.

### 환경 변수

`.env.example`을 `.env.local`로 복사해서 씁니다. `.env*.local`은 git에 올라가지 않습니다.

| 변수 | 설명 | 기본값 |
|---|---|---|
| `EXPO_PUBLIC_API_MOCK` | `true`면 백엔드 없이 앱 안의 목업 서버가 응답합니다 | `true` |
| `EXPO_PUBLIC_API_BASE_URL` | 백엔드 API 주소 | `http://localhost:8080/api` |
| `EXPO_PUBLIC_KAKAO_REST_API_KEY` | 카카오 로그인용 REST API 키 | (비어 있음) |
| `EXPO_PUBLIC_KAKAO_REDIRECT_URI` | 카카오 로그인 Redirect URI. 백엔드 `auth.kakao.allowed-redirect-uris`와 정확히 같아야 합니다 | `http://localhost:5173/auth/kakao/callback` |
| `EXPO_PUBLIC_KAKAO_JS_KEY` | 카카오맵 JavaScript 키 (코스 경로·장소 지도) | (비어 있음) |
| `EXPO_PUBLIC_KAKAO_MAP_ORIGIN` | 지도 웹뷰 페이지의 출처. 카카오 디벨로퍼스 > 플랫폼 > Web 도메인에 등록된 주소여야 합니다 | `http://localhost:8080` |

키 값은 팀 노션이나 담당자에게 받습니다. 저장소에 커밋하지 않습니다.

### 어떤 서버에 붙일지 고르기

**1. 목업 (백엔드 없이)**: 기본값입니다.

`EXPO_PUBLIC_API_MOCK=true`면 `src/api/mock/`이 실제 API와 같은 모양으로 응답합니다. 지역 뽑기, 코스 생성·편집, 초대, 공유 링크, 여행기, 관광지 핀까지 지원합니다.

- 데모 계정: `demo@tripin.app` / `tripin1234`
- 새로 가입해서 설문부터 진행할 수도 있습니다.

**2. 로컬 백엔드**

1. [backend](https://github.com/yeso-please/backend) 저장소의 로컬 개발 스택을 띄웁니다.
2. 폰과 PC의 포트를 연결합니다.

   ```bash
   adb reverse tcp:8080 tcp:8080
   adb reverse tcp:8081 tcp:8081
   ```

3. `.env.local`의 `EXPO_PUBLIC_API_MOCK`을 `false`로 바꿉니다. 공식 에뮬레이터에서는 주소를 `http://10.0.2.2:8080/api`로 씁니다.

로컬 백엔드는 사진 저장소(S3)가 꺼져 있어 사진 API가 503을 돌려줍니다.

**3. AWS 개발 서버**: 배포된 APK와 같은 서버입니다.

```dotenv
EXPO_PUBLIC_API_MOCK=false
EXPO_PUBLIC_API_BASE_URL=https://dn77qbtivmjzt.cloudfront.net/api
```

서버 주소가 `https`면 공유 링크가 `tripin://…` 대신 `https://…/course/{token}` 같은 웹 주소로 나갑니다. 카카오톡에서 `tripin://` 링크는 눌리지 않기 때문입니다.

## 스크립트

| 명령 | 하는 일 |
|---|---|
| `npm start` | Metro 개발 서버 (dev client) |
| `npm run android` | 네이티브 빌드 후 연결된 기기에 설치·실행 |
| `npm run prebuild` | `android/` 다시 생성 (`app.json`·플러그인을 바꾼 뒤) |
| `npm run typecheck` | 앱과 테스트 타입 검사 |
| `npm run lint` | ESLint (`eslint-config-expo`) |
| `npm test` | Jest 단위·컴포넌트 테스트 |
| `npm run test:perf:baseline` / `test:perf` | Reassure 렌더 성능 기준 저장 / 비교 |
| `npm run test:e2e` | Maestro E2E (실제 폰) |
| `npm run doctor` | expo-doctor로 의존성·설정 점검 |

새 패키지는 SDK에 맞는 버전을 받도록 `npm install` 대신 `npx expo install <패키지>`로 추가합니다.

## 프로젝트 구조

```text
src/
  app/                    expo-router 라우트 (파일 하나 = 화면 하나)
    (auth)/               로그인 · 회원가입 · 카카오 로그인 웹뷰
    (tabs)/               하단 탭: 홈(index) · 여행(travel) · 내 코스(courses) · MY(my)
    onboarding/, survey   첫 취향 설문 / 성향검사 다시 하기
    region/[sigCd]        뽑은 지역 추천
    trip/                 날짜(dates), [tripId]/ 코스 · 초대 · 참여자 · 장소 편집 · 장소 추가 · 식당 고르기 · 경로 지도
    invites/              받은 초대 목록
    invite/[token]/       초대 링크로 열기 · 코스 둘러보기 (로그인 전에도 열림)
    course/[token]        공유받은 코스 (로그인 없이, 읽기 전용)
    diary/[diaryId]/      여행기 보기 · 쓰기
    diary-link/[token]    공유받은 여행기 (로그인 없이)
    friend/[token]        친구 초대 링크 수락
    my/                   여행 성향 · 친구 · 보낸 친구 초대 링크 · 나의 여행 지도 · 친구의 여행 지도
  api/                    fetch 클라이언트, endpoints, 타입, queryKeys, mock/ (목업 서버)
  components/             공통 UI (AppText, Button, PressableScale, TopBar, StateViews …), 탭 바, 아이콘
  features/               기능별 화면 · 컴포넌트 · 훅
    home/  discover/  onboarding/  mbti/  trip/  course/  place/
    share/  diary/  invites/  auth/  kakaoMap/
  providers/              앱 전체 Provider (안전 영역 · QueryClient · 바텀시트 · 토스트)
  store/                  zustand 스토어
  theme/                  피그마 디자인 토큰 (색 · 글꼴 · 간격 · 그림자 · 모션)
  lib/                    날짜, 한국어 조사, 햅틱, 지도 투영, 이미지 주소, 시트 뒤로 가기
assets/                   폰트(Noto Sans KR 서브셋 · Keania One), 아이콘, 3D 지도 · 캐릭터 일러스트, 앱 아이콘
plugins/                  Expo 설정 플러그인 (카카오맵 지도 타일 평문 HTTP 허용 도메인)
tests/                    Jest · RNTL · Reassure 테스트
.maestro/                 Maestro E2E 흐름
.github/workflows/        main 푸시 → 릴리스 APK 빌드 · 배포
docs/                     앱 구조 · 흐름 · 결정 기록, API 요약
```

화면 흐름, 백엔드 API 번호와의 대응, 설계 결정은 [docs/app-architecture.md](docs/app-architecture.md)에 정리돼 있습니다.

## 테스트

```bash
npm run typecheck && npm run lint && npm test
```

| 종류 | 도구 | 위치 | 확인하는 것 |
|---|---|---|---|
| 단위 | Jest | `tests/api`, `tests/features`, `tests/lib` | API 클라이언트 토큰 재발급, 목업 API 계약, 설문 값 변환, 코스 포맷·순서 변경, 지도 투영, 링크 상태, 장소 추가 |
| 컴포넌트 | React Native Testing Library | `tests/components` | 버튼·태그·세그먼트, 여행기 본문, 여행 지도 핀, 보낸 링크 목록 |
| 렌더 성능 | Reassure | `tests/perf` | 핀 30개 여행 지도, 사진 30장 여행기의 렌더 시간·횟수 |
| E2E | Maestro | `.maestro/` | 하단 탭, 여행 지도 → 여행기, 친구 지도, 여행기 수정 ([설명](.maestro/README.md)) |
| 실기기 성능 | Flashlight | `.maestro/perf/` | 릴리스 빌드의 FPS · CPU · 메모리 |

## 배포

`main`에 앱 코드(`src/`, `assets/`, `app.json`, `package*.json`, 워크플로 파일)가 푸시되면 [`release-apk.yml`](.github/workflows/release-apk.yml)이 실행됩니다. 15분쯤 걸립니다.

```text
테스트 → AWS 권한(OIDC) → SSM에서 카카오 키 읽기 → expo prebuild
  → gradlew assembleRelease (arm64-v8a) → S3 업로드 → CloudFront 캐시 비우기
```

- 결과 APK는 [다운로드 페이지](https://dn77qbtivmjzt.cloudfront.net/download/)와 Actions 실행의 아티팩트에 올라갑니다.
- 옛 32비트 폰용 APK가 필요하면 Actions에서 **Release APK**를 직접 실행하고 CPU 종류에 `arm64-v8a,armeabi-v7a`를 넣습니다.
- AWS 역할, 카카오 키 저장 위치, 키를 바꾸는 방법은 [docs/app-architecture.md](docs/app-architecture.md#apk-배포)와 [infra](https://github.com/yeso-please/infra) 저장소에 있습니다.

## 문제 해결

<details>
<summary><b>Gradle 빌드가 이상한 경로 오류로 실패해요</b></summary>

프로젝트 경로에 한글이나 공백이 있으면 Android Gradle 빌드가 깨집니다. `C:\dev\tripin\frontend`처럼 영문 경로로 옮깁니다.
</details>

<details>
<summary><b>빌드 중 prefab / CMake 경고로 실패해요</b></summary>

JDK 25로 빌드하고 있을 가능성이 큽니다. `JAVA_HOME`을 JDK 21로 바꾸고 다시 빌드합니다.
</details>

<details>
<summary><b>무선 디버깅 연결이 자꾸 끊겨요</b></summary>

LDPlayer 같은 에뮬레이터가 자기 adb(다른 버전)로 5037 포트를 쓰면 서로 서버를 끕니다. 다른 포트에서 adb 서버를 띄웁니다.

```bash
ANDROID_ADB_SERVER_PORT=5038 adb devices
```

Maestro는 5037 포트만 찾으므로, 이때는 5037 → 5038로 넘겨 주는 중계가 필요합니다.
</details>

<details>
<summary><b>지도가 회색이거나 <code>401 domain mismatched</code>가 나와요</b></summary>

`EXPO_PUBLIC_KAKAO_MAP_ORIGIN`이 카카오 디벨로퍼스 > 플랫폼 > Web 도메인에 등록된 주소가 아닙니다.

- 지금 등록된 주소는 `http://localhost:8080`입니다.
- AWS 주소(`https://dn77qbtivmjzt.cloudfront.net`)는 아직 등록 전이라 AWS용 빌드도 localhost 출처를 씁니다.
- 이 출처에서는 카카오 SDK가 지도 타일을 http로 받습니다. 그래서 릴리스 빌드는 `plugins/withKakaoMapCleartext.js`로 카카오 도메인에만 평문 HTTP를 허용합니다.
- https 도메인을 등록하면 이 우회는 빼도 됩니다.
</details>

<details>
<summary><b>로컬 백엔드에서 앱을 다시 켜면 로그인이 풀려요</b></summary>

로컬 백엔드를 개발 RDS로 띄울 때 refresh 쿠키의 `Secure`가 켜져 있으면 http에서 쿠키가 저장되지 않습니다. 백엔드를 `APP_AUTH_COOKIE_SECURE=false`로 띄웁니다.
</details>

<details>
<summary><b>여행기 사진 올리기가 503이에요</b></summary>

사진 저장소(S3)는 AWS 서버에만 켜져 있습니다. 사진 기능은 AWS 개발 서버나 목업으로 확인합니다.
</details>

## 개발 규칙

자세한 규칙은 [docs/app-architecture.md](docs/app-architecture.md#규칙)에 있습니다. 자주 쓰는 것만 추립니다.

- **디자인 토큰**: 색·글꼴·간격은 숫자를 직접 쓰지 않고 `@/theme` 토큰을 씁니다. 텍스트는 `AppText variant`만 씁니다.
- **터치**: 탭할 수 있는 요소는 `PressableScale`(눌림 축소 + 햅틱)을 쓰고, 터치 영역은 44 이상으로 둡니다.
- **서버 데이터**: TanStack Query와 `queryKeys`를 씁니다. 오류는 `isApiError(e, "CODE")`처럼 코드로 나눕니다.
  - 목록 화면에는 로딩 / 빈 상태 / 오류 화면(`StateViews`)을 꼭 둡니다.
- **목업**: 새 API를 쓰면 `src/api/mock/`에도 같은 모양으로 추가합니다.
- **원격 이미지**: 항상 `secureImageUrl()`을 거칩니다. 관광공사 이미지가 `http://`로 오기 때문입니다.
- **코드 스타일**: 쌍따옴표, 세미콜론, camelCase.
- **커밋**: `feat: …`, `fix: …`, `docs: …` 형식으로 쓰고, 한 커밋에는 한 가지 변경만 담습니다.
- **디자인 기준**: 피그마 `IvlST03u2P3Un9OTjUSyBk`의 "초안" 섹션이 1순위입니다.

## 관련 저장소

| 저장소 | 내용 |
|---|---|
| [backend](https://github.com/yeso-please/backend) | Spring Boot API 서버. API 계약(`docs/api/`)과 화면별 가이드(`docs/frontend-guide.md`)가 여기에 있습니다 |
| [ai](https://github.com/yeso-please/ai) | 회원 취향과 관광지를 잇는 임베딩 서버, 취향 모델 평가 · 학습 |
| [infra](https://github.com/yeso-please/infra) | Terraform(AWS), 다운로드 · 공유 링크 웹 페이지(`site/`) |
| [demo](https://github.com/yeso-please/demo) | 여행 기록 글로 비슷한 국내 코스를 찾아 주는 Spring Boot 데모 |

---

<p align="center">팀 <b>예소를 부탁해</b> · 2026</p>
