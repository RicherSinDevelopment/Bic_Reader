import type { ReaderTransition } from "@/stores/readerSettingsStore";
import { useCallback, type RefObject } from "react";
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
        resetPage: false,
      })
    );
  }, [transition, webViewRef]);

  return {
    isPaged: transition === "pager",
    syncPageTransition,
  };
}
