import type { ReaderTransition } from "@/stores/readerSettingsStore";
import { useCallback, useEffect, type RefObject } from "react";
import type { WebView } from "react-native-webview";

type UsePageTransitionOptions = {
  webViewRef: RefObject<WebView | null>;
  transition: ReaderTransition;
};

export function usePageTransition({
  webViewRef,
  transition,
}: UsePageTransitionOptions) {
  const syncPageTransition = useCallback(() => {
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: "pageTransition",
        transition,
      })
    );
  }, [transition, webViewRef]);

  useEffect(() => {
    syncPageTransition();
  }, [syncPageTransition]);

  return {
    isPaged: transition !== "scroll",
    syncPageTransition,
  };
}