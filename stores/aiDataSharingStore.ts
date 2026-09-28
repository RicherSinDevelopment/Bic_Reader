import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

export type AIDataSharingConsent = 'unset' | 'allowed' | 'denied';

const STORAGE_KEY = 'bic-reader-ai-data-sharing-consent-v1';

function readStoredConsent(): AIDataSharingConsent {
  try {
    const stored = Storage.getItemSync(STORAGE_KEY);
    return stored === 'allowed' || stored === 'denied' ? stored : 'unset';
  } catch {
    return 'unset';
  }
}

type AIDataSharingState = {
  consent: AIDataSharingConsent;
  setConsent: (consent: Exclude<AIDataSharingConsent, 'unset'>) => void;
};

export const useAIDataSharingStore = create<AIDataSharingState>((set) => ({
  consent: readStoredConsent(),
  setConsent: (consent) => {
    try {
      Storage.setItemSync(STORAGE_KEY, consent);
    } catch (error) {
      console.warn('Could not save the AI data sharing preference:', error);
    }
    set({ consent });
  },
}));
