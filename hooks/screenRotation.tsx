import { useReaderSettingsStore } from "@/stores/readerSettingsStore";
import * as ScreenOrientation from "expo-screen-orientation";
import { useCallback, useEffect, useRef } from "react";

export function useScreenRotation(setIsLandscape: (value: boolean) => void) {
  const lastLandscape = useRef<boolean | null>(null);
  const orientationWork = useRef(Promise.resolve());

  // Commit the orientation change immediately. The native viewport has already
  // rotated by the time the orientation event arrives, so deferring the state
  // update (e.g. with setTimeout) only leaves React rendering with stale
  // isLandscape values against the already-rotated layout — the source of the
  // double-layout "jump" during rotation.
  const updateLandscape = useCallback(
    (value: boolean) => {
      if (lastLandscape.current === value) return;
      lastLandscape.current = value;
      setIsLandscape(value);
    },
    [setIsLandscape],
  );

  const disableRotation = useReaderSettingsStore(
    (state) => state.disableRotation,
  );

  const guideEnabled = useReaderSettingsStore(
    (state) => state.lineGuideEnabled || state.wordGuideEnabled,
  );

  useEffect(() => {
    let subscription: ScreenOrientation.Subscription | undefined;
    let isActive = true;

    const setupOrientation = async () => {
      if (!isActive) return;
      if (disableRotation) {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        );

        if (isActive) updateLandscape(false);
        return;
      }

      if (guideEnabled) {
        const orientation = await ScreenOrientation.getOrientationAsync();
        if (!isActive) return;
        const locks = {
          [ScreenOrientation.Orientation.PORTRAIT_UP]: ScreenOrientation.OrientationLock.PORTRAIT_UP,
          [ScreenOrientation.Orientation.PORTRAIT_DOWN]: ScreenOrientation.OrientationLock.PORTRAIT_DOWN,
          [ScreenOrientation.Orientation.LANDSCAPE_LEFT]: ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
          [ScreenOrientation.Orientation.LANDSCAPE_RIGHT]: ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
        };
        const lock = locks[orientation as keyof typeof locks];
        if (lock !== undefined) {
          await ScreenOrientation.lockAsync(lock);
          if (isActive) updateLandscape(
            orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
            orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT,
          );
        }
        return;
      }

      await ScreenOrientation.unlockAsync();
      if (!isActive) return;

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

    // Serialize toggles so an older native lock cannot finish after unlocking.
    orientationWork.current = orientationWork.current
      .then(setupOrientation)
      .catch((error) => console.warn("Reader orientation update failed", error));

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, [disableRotation, guideEnabled, updateLandscape]);

  // Leaving the reader returns the rest of the app to its portrait contract.
  // Keep this separate from the reactive effect above: its old cleanup ran on
  // every guide toggle and caused an unwanted portrait frame before relocking.
  useEffect(
    () => () => {
      orientationWork.current = orientationWork.current
        .then(() => ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ))
        .catch((error) => console.warn("Reader orientation reset failed", error));
    },
    [],
  );
}
