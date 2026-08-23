import Storage from "expo-sqlite/kv-store";
import { Appearance, type ColorSchemeName } from "react-native";
import { create } from "zustand";

export type AppearancePreference = "system" | "light" | "dark";

const STORAGE_KEY = "bic-reader-appearance";

function readStoredPreference(): AppearancePreference {
  try {
    const stored = Storage.getItemSync(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function applyPreference(preference: AppearancePreference) {
  Appearance.setColorScheme(
    preference === "system" ? null : (preference as ColorSchemeName),
  );
}

const initialPreference = readStoredPreference();
applyPreference(initialPreference);

type AppearanceState = {
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
};

export const useAppearanceStore = create<AppearanceState>((set) => ({
  preference: initialPreference,
  setPreference: (preference) => {
    applyPreference(preference);
    try {
      Storage.setItemSync(STORAGE_KEY, preference);
    } catch (error) {
      console.warn("Could not save the appearance preference:", error);
    }
    set({ preference });
  },
}));
