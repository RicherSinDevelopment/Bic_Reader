import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import Storage from 'expo-sqlite/kv-store';

const readerSettingsStorage: StateStorage = {
  getItem: (name) => Storage.getItemSync(name),
  setItem: (name, value) => Storage.setItemSync(name, value),
  removeItem: (name) => Storage.removeItemSync(name),
};

export type ReaderTransition = "scroll" | "pager";
export type ReaderSpacingPreset =
  | "compact"
  | "comfortable"
  | "relaxed"
  | "custom";
export type ReaderMarginPreset = "compact" | "comfortable" | "relaxed";
export type ReaderGuideColor =
  | "#F59E0B"
  | "#65A30D"
  | "#3B82F6"
  | "#8B5CF6"
  | "#F43F5E";

type ReaderSettingsState = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  spacingPreset: ReaderSpacingPreset;
  verticalMarginPreset: ReaderMarginPreset;
  horizontalMarginPreset: ReaderMarginPreset;
  letterSpacing: number;
  wordSpacing: number;
  bold: boolean;
  automaticHyphenation: boolean;
  disableRotation: boolean;
  hideTopBarOnScroll: boolean;
  lineGuideEnabled: boolean;
  wordGuideEnabled: boolean;
  guideBackgroundDimming: number;
  guideColor: ReaderGuideColor;
  switchHighlightColor: ReaderGuideColor;
  transition: ReaderTransition;

  setFontFamily: (fontFamily: string) => void;

  backgroundColor: string;
  textColor: string;
  colorsCustomized: boolean;

  increaseFontSize: () => void;
  decreaseFontSize: () => void;

  increaseLineHeight: () => void;
  decreaseLineHeight: () => void;
  setSpacingPreset: (preset: Exclude<ReaderSpacingPreset, "custom">) => void;
  setVerticalMarginPreset: (preset: ReaderMarginPreset) => void;
  setHorizontalMarginPreset: (preset: ReaderMarginPreset) => void;

  increaseLetterSpacing: () => void;
  decreaseLetterSpacing: () => void;

  increaseWordSpacing: () => void;
  decreaseWordSpacing: () => void;

  toggleBold: () => void;
  setAutomaticHyphenation: (enabled: boolean) => void;
  toggleDisableRotation: () => void;
  setHideTopBarOnScroll: (enabled: boolean) => void;
  setLineGuideEnabled: (enabled: boolean) => void;
  setWordGuideEnabled: (enabled: boolean) => void;
  setGuideBackgroundDimming: (percentage: number) => void;
  setGuideColor: (color: ReaderGuideColor) => void;
  setSwitchHighlightColor: (color: ReaderGuideColor) => void;
  setTransition: (transition: ReaderTransition) => void;

  setBackgroundColor: (color: string) => void;
  setTextColor: (color: string) => void;
  setColorPreset: (backgroundColor: string, textColor: string) => void;
};

export const useReaderSettingsStore = create<ReaderSettingsState>()(
  persist((set) => ({
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 22,
    lineHeight: 1.5,
    paragraphSpacing: 0.3,
    spacingPreset: "comfortable",
    verticalMarginPreset: "comfortable",
    horizontalMarginPreset: "comfortable",
    letterSpacing: 0,
    wordSpacing: 0,
    bold: false,
    automaticHyphenation: true,
    disableRotation: false,
    hideTopBarOnScroll: false,
    lineGuideEnabled: false,
    wordGuideEnabled: false,
    guideBackgroundDimming: 60,
    guideColor: "#F59E0B",
    switchHighlightColor: "#F59E0B",
    transition: "scroll",

    setFontFamily: (fontFamily) => set({ fontFamily }),

    // Default colors
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    colorsCustomized: false,

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
        spacingPreset: "custom",
      })),

    decreaseLineHeight: () =>
      set((state) => ({
        lineHeight: Math.max(
          state.lineHeight - 0.1,
          1
        ),
        spacingPreset: "custom",
      })),

    setSpacingPreset: (preset) => {
      const settings = {
        compact: { lineHeight: 1.4, paragraphSpacing: 0.2 },
        comfortable: { lineHeight: 1.5, paragraphSpacing: 0.3 },
        relaxed: { lineHeight: 1.7, paragraphSpacing: 0.45 },
      }[preset];
      set({
        ...settings,
        letterSpacing: 0,
        wordSpacing: 0,
        spacingPreset: preset,
      });
    },
    setVerticalMarginPreset: (verticalMarginPreset) => set({ verticalMarginPreset }),
    setHorizontalMarginPreset: (horizontalMarginPreset) => set({ horizontalMarginPreset }),

    increaseLetterSpacing: () =>
      set((state) => ({
        letterSpacing: Math.min(
          state.letterSpacing + 0.5,
          5
        ),
        spacingPreset: "custom",
      })),

    decreaseLetterSpacing: () =>
      set((state) => ({
        letterSpacing: Math.max(
          state.letterSpacing - 0.5,
          0
        ),
        spacingPreset: "custom",
      })),

    increaseWordSpacing: () =>
      set((state) => ({
        wordSpacing: Math.min(
          state.wordSpacing + 1,
          10
        ),
        spacingPreset: "custom",
      })),

    decreaseWordSpacing: () =>
      set((state) => ({
        wordSpacing: Math.max(
          state.wordSpacing - 1,
          0
        ),
        spacingPreset: "custom",
      })),

    toggleBold: () =>
      set((state) => ({
        bold: !state.bold,
      })),

    setAutomaticHyphenation: (enabled) => set({ automaticHyphenation: enabled }),

    toggleDisableRotation: () =>
      set((state) => ({
        disableRotation: !state.disableRotation,
      })),
    setHideTopBarOnScroll: (enabled) => set({ hideTopBarOnScroll: enabled }),
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
    setGuideColor: (guideColor) => set({ guideColor }),
    setSwitchHighlightColor: (switchHighlightColor) => set({ switchHighlightColor }),
    setTransition: (transition) => set({ transition }),

    // Change background
    setBackgroundColor: (color) =>
      set((state) =>
        color.toLowerCase() === state.textColor.toLowerCase()
          ? state
          : { backgroundColor: color, colorsCustomized: true }
      ),

    // Change text color
    setTextColor: (color) =>
      set((state) =>
        color.toLowerCase() === state.backgroundColor.toLowerCase()
          ? state
          : { textColor: color, colorsCustomized: true }
      ),

    setColorPreset: (backgroundColor, textColor) =>
      set((state) =>
        backgroundColor.toLowerCase() === textColor.toLowerCase()
          ? state
          : { backgroundColor, textColor, colorsCustomized: true }
      ),
  }), {
    name: 'bic-reader-settings',
    storage: createJSONStorage(() => readerSettingsStorage),
    version: 1,
  }),
);
