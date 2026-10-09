import { Easing } from "react-native-reanimated";

// 앱 전체에서 같은 느낌의 움직임을 쓰도록 스프링·타이밍 값을 모아 둡니다.
export const motion = {
  spring: {
    // 버튼 눌림, 칩 선택처럼 짧고 탄력 있는 반응
    snappy: { damping: 18, stiffness: 320, mass: 0.6 },
    // 시트·카드처럼 큰 요소의 부드러운 이동
    gentle: { damping: 22, stiffness: 180, mass: 1 },
    // 핀 착지처럼 살짝 튀는 움직임
    bouncy: { damping: 9, stiffness: 220, mass: 0.8 },
  },
  timing: {
    fast: { duration: 160, easing: Easing.out(Easing.quad) },
    base: { duration: 240, easing: Easing.out(Easing.cubic) },
    slow: { duration: 420, easing: Easing.inOut(Easing.cubic) },
  },
  pressScale: 0.96,
  stagger: 70,
} as const;
