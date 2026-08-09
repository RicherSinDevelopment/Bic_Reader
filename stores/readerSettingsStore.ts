import { create } from 'zustand';

export type ReaderTransition = "scroll" | "pager";

type ReaderSettingsState = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  bold: boolean;
  disableRotation: boolean;
  lineGuideEnabled: boolean;
  wordGuideEnabled: boolean;
  guideBackgroundDimming: number;
  transition: ReaderTransition;

  setFontFamily: (fontFamily: string) => void;

  backgroundColor: string;
  textColor: string;

  increaseFontSize: () => void;
  decreaseFontSize: () => void;

  increaseLineHeight: () => void;
  decreaseLineHeight: () => void;

  increaseLetterSpacing: () => void;
  decreaseLetterSpacing: () => void;

  increaseWordSpacing: () => void;
  decreaseWordSpacing: () => void;

  toggleBold: () => void;
  toggleDisableRotation: () => void;
  setLineGuideEnabled: (enabled: boolean) => void;
  setWordGuideEnabled: (enabled: boolean) => void;
  setGuideBackgroundDimming: (percentage: number) => void;
  setTransition: (transition: ReaderTransition) => void;

  setBackgroundColor: (color: string) => void;
  setTextColor: (color: string) => void;
  setColorPreset: (backgroundColor: string, textColor: string) => void;
};

export const useReaderSettingsStore =
  create<ReaderSettingsState>((set) => ({
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 22,
    lineHeight: 1.72,
    letterSpacing: 0,
    wordSpacing: 0,
    bold: false,
    disableRotation: false,
    lineGuideEnabled: false,
    wordGuideEnabled: false,
    guideBackgroundDimming: 60,
    transition: "scroll",

    setFontFamily: (fontFamily) => set({ fontFamily }),

    // Default colors
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',

    increaseFontSize: () =>
      set((state) => ({
        fontSize: Math.min(state.fontSize + 2, 40),
      })),

    decreaseFontSize: () =>
      set((state) => ({
        fontSize: Math.max(state.fontSize - 2, 10),
      })),

    increaseLineHeight: () =>
      set((state) => ({
        lineHeight: Math.min(
          state.lineHeight + 0.1,
          3
        ),
      })),

    decreaseLineHeight: () =>
      set((state) => ({
        lineHeight: Math.max(
          state.lineHeight - 0.1,
          1
        ),
      })),

    increaseLetterSpacing: () =>
      set((state) => ({
        letterSpacing: Math.min(
          state.letterSpacing + 0.5,
          5
        ),
      })),

    decreaseLetterSpacing: () =>
      set((state) => ({
        letterSpacing: Math.max(
          state.letterSpacing - 0.5,
          0
        ),
      })),

    increaseWordSpacing: () =>
      set((state) => ({
        wordSpacing: Math.min(
          state.wordSpacing + 1,
          10
        ),
      })),

    decreaseWordSpacing: () =>
      set((state) => ({
        wordSpacing: Math.max(
          state.wordSpacing - 1,
          0
        ),
      })),

    toggleBold: () =>
      set((state) => ({
        bold: !state.bold,
      })),

    toggleDisableRotation: () =>
      set((state) => ({
        disableRotation: !state.disableRotation,
      })),
    setLineGuideEnabled: (enabled) => set({
      lineGuideEnabled: enabled,
      ...(enabled ? { wordGuideEnabled: false } : {}),
    }),
    setWordGuideEnabled: (enabled) => set({
      wordGuideEnabled: enabled,
      ...(enabled ? { lineGuideEnabled: false } : {}),
    }),
    setGuideBackgroundDimming: (percentage) => set({
      guideBackgroundDimming: Math.max(0, Math.min(90, percentage)),
    }),
    setTransition: (transition) => set({ transition }),

    // Change background
    setBackgroundColor: (color) =>
      set((state) =>
        color.toLowerCase() === state.textColor.toLowerCase()
          ? state
          : { backgroundColor: color }
      ),

    // Change text color
    setTextColor: (color) =>
      set((state) =>
        color.toLowerCase() === state.backgroundColor.toLowerCase()
          ? state
          : { textColor: color }
      ),

    setColorPreset: (backgroundColor, textColor) =>
      set((state) =>
        backgroundColor.toLowerCase() === textColor.toLowerCase()
          ? state
          : { backgroundColor, textColor }
      ),
  }));
