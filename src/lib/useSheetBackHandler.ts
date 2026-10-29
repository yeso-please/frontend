import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { type RefObject, useEffect, useState } from "react";
import { BackHandler } from "react-native";

/**
 * 바텀시트가 열려 있으면 안드로이드 뒤로 가기가 화면 대신 시트를 닫게 합니다 (@gorhom/bottom-sheet는 직접 처리하지 않음).
 * 반환값의 onChange를 BottomSheetModal에 넘깁니다.
 */
export function useSheetBackHandler(ref: RefObject<BottomSheetModal | null> | null | undefined | ((instance: BottomSheetModal | null) => void)) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || !ref || typeof ref === "function") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      ref.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [open, ref]);
  return { onChange: (index: number) => setOpen(index >= 0) };
}
