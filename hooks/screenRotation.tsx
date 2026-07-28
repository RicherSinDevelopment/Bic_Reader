import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect } from "react";

export function useScreenRotation(
  setIsLandscape: (value: boolean) => void
) {
  useEffect(() => {
    let subscription:
      | ScreenOrientation.Subscription
      | undefined;

    const setupOrientation = async () => {
      // Allow rotation while ReaderView is open
      await ScreenOrientation.unlockAsync();

      // Get current orientation
      const orientation =
        await ScreenOrientation.getOrientationAsync();

      const landscape =
        orientation ===
          ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation ===
          ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

      setIsLandscape(landscape);

      // Listen for orientation changes
      subscription =
        ScreenOrientation.addOrientationChangeListener(
          (event) => {
            const orientation =
              event.orientationInfo.orientation;

            const landscape =
              orientation ===
                ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
              orientation ===
                ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

            setIsLandscape(landscape);
          }
        );
    };

    setupOrientation();

    return () => {
      // Remove listener when ReaderView unmounts
      if (subscription) {
        ScreenOrientation.removeOrientationChangeListener(
          subscription
        );
      }

      // Lock back to portrait after leaving ReaderView
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
    };
  }, [setIsLandscape]);
}
