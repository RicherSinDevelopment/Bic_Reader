import { useReaderSettingsStore } from "@/stores/readerSettingsStore";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect } from "react";

export function useScreenRotation(
  setIsLandscape: (value: boolean) => void
) {
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

        if (isActive) setIsLandscape(false);
        return;
      }

      await ScreenOrientation.unlockAsync();

      const orientation = await ScreenOrientation.getOrientationAsync();
      const landscape =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

      if (!isActive) return;

      setIsLandscape(landscape);
      subscription = ScreenOrientation.addOrientationChangeListener((event) => {
        const nextOrientation = event.orientationInfo.orientation;
        const nextIsLandscape =
          nextOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          nextOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

        setIsLandscape(nextIsLandscape);
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
  }, [disableRotation, setIsLandscape]);
}