import { create } from 'zustand';

type ReaderSettingsState = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  bold: boolean;

  increaseFontSize: () => void;
  decreaseFontSize: () => void;

  increaseLineHeight: () => void;
  decreaseLineHeight: () => void;

  increaseLetterSpacing: () => void;
  decreaseLetterSpacing: () => void;

  increaseWordSpacing: () => void;
  decreaseWordSpacing: () => void;

  toggleBold: () => void;
};

export const useReaderSettingsStore = create<ReaderSettingsState>((set) => ({
  fontSize: 18,
  lineHeight: 1.72,
  letterSpacing: 0,
  wordSpacing: 0,
  bold: false,

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
      lineHeight: Math.min(state.lineHeight + 0.1, 3),
    })),

  decreaseLineHeight: () =>
    set((state) => ({
      lineHeight: Math.max(state.lineHeight - 0.1, 1),
    })),

  increaseLetterSpacing: () =>
    set((state) => ({
      letterSpacing: Math.min(state.letterSpacing + 0.5, 5),
    })),

  decreaseLetterSpacing: () =>
    set((state) => ({
      letterSpacing: Math.max(state.letterSpacing - 0.5, 0),
    })),

  increaseWordSpacing: () =>
    set((state) => ({
      wordSpacing: Math.min(state.wordSpacing + 1, 10),
    })),

  decreaseWordSpacing: () =>
    set((state) => ({
      wordSpacing: Math.max(state.wordSpacing - 1, 0),
    })),

  toggleBold: () =>
    set((state) => ({
      bold: !state.bold,
    })),
}));