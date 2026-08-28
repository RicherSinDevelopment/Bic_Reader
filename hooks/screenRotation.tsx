import { useReaderSettingsStore } from "@/stores/readerSettingsStore";
import * as ScreenOrientation from "expo-screen-orientation";
import { useCallback, useEffect, useRef } from "react";

export function useScreenRotation(
  setIsLandscape: (value: boolean) => void
) {
  const lastLandscape = useRef<boolean | null>(null);

  // Commit the orientation change immediately. The native viewport has already
  // rotated by the time the orientation event arrives, so deferring the state
  // update (e.g. with setTimeout) only leaves React rendering with stale
  // isLandscape values against the already-rotated layout — the source of the
  // double-layout "jump" during rotation.
  const updateLandscape = useCallback((value: boolean) => {
    if (lastLandscape.current === value) return;
    lastLandscape.current = value;
    setIsLandscape(value);
  }, [setIsLandscape]);

  const disableRotation = useReaderSettingsStore(
    (state) => state.disableRotation
  );

  useEffect(() => {
    let subscription: ScreenOrientation.Subscription | undefined;
    let isActive = true;

    const setupOrientation = async () => {
      if (disableRotation) {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );

        if (isActive) updateLandscape(false);
        return;
      }

      await ScreenOrientation.unlockAsync();

      const orientation = await ScreenOrientation.getOrientationAsync();
      const landscape =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

      if (!isActive) return;

      updateLandscape(landscape);
      subscription = ScreenOrientation.addOrientationChangeListener((event) => {
        const nextOrientation = event.orientationInfo.orientation;
        const nextIsLandscape =
          nextOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          nextOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

        updateLandscape(nextIsLandscape);
      });
    };

    void setupOrientation();

    return () => {
      isActive = false;
      subscription?.remove();

      if (!disableRotation) {
        void ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );
      }
    };
  }, [disableRotation, updateLandscape]);
}
