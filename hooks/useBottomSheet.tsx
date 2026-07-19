import BottomSheet from "@gorhom/bottom-sheet";
import { useCallback, useRef } from "react";

export function useBottomSheet() {
  const bottomSheetRef = useRef<BottomSheet>(null);

  const open = useCallback(() => {
    bottomSheetRef.current?.expand();
  }, []);

  const close = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);

  return {
    bottomSheetRef,
    open,
    close,
  };
}