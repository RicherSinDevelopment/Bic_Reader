import 'expo-sqlite/localStorage/install';

const ONBOARDING_COMPLETE_KEY = 'bic_reader_onboarding_complete';

export function hasCompletedOnboarding() {
  return globalThis.localStorage?.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
}

export function completeOnboarding() {
  globalThis.localStorage?.setItem(ONBOARDING_COMPLETE_KEY, 'true');
}

export function resetOnboarding() {
  globalThis.localStorage?.removeItem(ONBOARDING_COMPLETE_KEY);
}
