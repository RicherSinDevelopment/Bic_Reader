import * as Speech from "expo-speech";
import { useCallback } from "react";

type BoundaryEvent =
  | { charIndex: number; charLength?: number }
  | SpeechSynthesisEvent;

type UseHighlightingTextOptions = {
  onHighlight: (charIndex: number, charLength: number) => void;
  onClear: () => void;
};

export function useHighlightingText({
  onHighlight,
  onClear,
}: UseHighlightingTextOptions) {
  const createBoundaryHandler = useCallback(
    (chunkOffset: number): NonNullable<Speech.SpeechOptions["onBoundary"]> =>
      ((event: BoundaryEvent) => {
        const charIndex = chunkOffset + event.charIndex;
        const charLength = "charLength" in event ? (event.charLength ?? 1) : 1;

        onHighlight(charIndex, charLength);
      }) as NonNullable<Speech.SpeechOptions["onBoundary"]>,
    [onHighlight]
  );

  return {
    createBoundaryHandler,
    clearHighlight: onClear,
  };
}