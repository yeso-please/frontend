// Jest 공통 준비: 네이티브 저장소를 메모리 모의 객체로 바꿉니다.
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
