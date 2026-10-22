import { type RefObject, useEffect, useRef, useState } from "react";
import type { ScrollView } from "react-native";

/** 입력이 멈추고 delay(ms) 뒤의 값 (검색어) */
export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * 목록 행 위치를 기억해 두었다가 지도 핀을 누르면 그 행으로 스크롤합니다.
 * 행은 목록 컨테이너 안에 있으므로 컨테이너의 y와 행의 y를 더합니다. ScrollView ref는 화면이 만들어 넘깁니다.
 */
export function useScrollToRow(scrollRef: RefObject<ScrollView | null>) {
  const listY = useRef(0);
  const rowY = useRef(new Map<string, number>());
  return {
    onListLayout: (y: number) => {
      listY.current = y;
    },
    onRowLayout: (key: string, y: number) => {
      rowY.current.set(key, y);
    },
    scrollTo: (key: string, offset = 96) => {
      const y = rowY.current.get(key);
      if (y == null) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, listY.current + y - offset), animated: true });
    },
    scrollToTop: () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
  };
}
