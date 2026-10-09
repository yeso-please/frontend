# TriPin 앱 (frontend)

우연이 만든 최고의 여행 — 랜덤으로 핀을 꽂아 국내 여행지를 발견하고, 취향에 맞춘 코스를 친구와 함께 만드는 앱입니다.

React Native(Expo SDK 57) Android 앱입니다.

- 구조·규칙·흐름 결정: [docs/app-architecture.md](docs/app-architecture.md)
- API: [docs/frontend-api-guide.md](docs/frontend-api-guide.md)

## 준비물

- Node 24 LTS
- JDK 21: `JAVA_HOME`을 JDK 21로 지정합니다.
- Android SDK: `ANDROID_HOME` 환경변수를 설정합니다.
- 실행 기기: USB 디버깅을 켠 안드로이드 폰 또는 에뮬레이터
- **프로젝트 경로:** 한글·공백이 없는 곳에 clone합니다(예: `C:\dev\tripin\frontend`). 한글 경로에서는 Android Gradle 빌드가 깨집니다.

## 실행

```bash
npm install
cp .env.example .env.local
npm run android
```

- `npm run android`는 처음 한 번 네이티브 빌드를 하고 기기에 앱을 설치합니다.
- 이후에는 Metro만 띄우면 됩니다.

```bash
npm start
```

### 백엔드 없이 개발하기 (목업)

`.env.local`의 `EXPO_PUBLIC_API_MOCK=true`(기본값)면 앱 안의 목업 서버(`src/api/mock`)가 응답합니다.

- 데모 계정: `demo@tripin.app` / `tripin1234`
- 새로 가입해서 온보딩부터 진행할 수도 있습니다.

### 로컬 백엔드에 붙이기

1. backend 저장소의 로컬 개발 스택을 띄웁니다.
2. 아래처럼 포트를 연결합니다.

```bash
adb reverse tcp:8080 tcp:8080
```

3. `.env.local`의 `EXPO_PUBLIC_API_MOCK`을 `false`로 바꿉니다.

## 검사

```bash
npm run typecheck
npm run lint
```
