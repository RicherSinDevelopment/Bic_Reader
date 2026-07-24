// stores/readerSettingsStore.ts

import { create } from 'zustand';

type ReaderSettingsState = {
  fontSize: number;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
};

export const useReaderSettingsStore = create<ReaderSettingsState>((set) => ({
  fontSize: 18,

  increaseFontSize: () =>
    set((state) => ({
      fontSize: Math.min(state.fontSize + 2, 40),
    })),

  decreaseFontSize: () =>
    set((state) => ({
      fontSize: Math.max(state.fontSize - 2, 10),
    })),
}));