// Jest 공통 준비: 네이티브 저장소를 메모리 모의 객체로 바꿉니다.
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// 화면 컴포넌트 테스트(React Native Testing Library)용: 애니메이션·안전 영역 네이티브 모듈을 라이브러리가 주는 모의 객체로 바꿉니다.
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
