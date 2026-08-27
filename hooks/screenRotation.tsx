import { useReaderSettingsStore } from "@/stores/readerSettingsStore";
import * as ScreenOrientation from "expo-screen-orientation";
import { useCallback, useEffect, useRef } from "react";

export function useScreenRotation(
  setIsLandscape: (value: boolean) => void
) {
  const lastLandscape = useRef<boolean | null>(null);
  const orientationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateLandscape = useCallback((value: boolean) => {
    if (lastLandscape.current === value) return;

    if (orientationTimer.current) clearTimeout(orientationTimer.current);
    const commit = () => {
      lastLandscape.current = value;
      setIsLandscape(value);
      orientationTimer.current = null;
    };

    // Apply the initial state immediately. During rotation, wait briefly for
    // the native viewport to settle so the Reader paginates only once.
    if (lastLandscape.current === null) commit();
    else orientationTimer.current = setTimeout(commit, 100);
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
      if (orientationTimer.current) {
        clearTimeout(orientationTimer.current);
        orientationTimer.current = null;
      }
      subscription?.remove();

      if (!disableRotation) {
        void ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );
      }
    };
  }, [disableRotation, updateLandscape]);
}
