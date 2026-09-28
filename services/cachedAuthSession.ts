import type { Session } from '@supabase/supabase-js';

export function defaultSupabaseAuthStorageKey(supabaseUrl: string) {
  try {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

export function parseCachedAuthSession(value: string | null): Session | null {
  if (!value) return null;

  try {
    const candidate = JSON.parse(value) as Partial<Session>;
    if (
      typeof candidate.access_token !== 'string' ||
      typeof candidate.refresh_token !== 'string' ||
      !candidate.user ||
      typeof candidate.user.id !== 'string'
    ) {
      return null;
    }
    return candidate as Session;
  } catch {
    return null;
  }
}

export function readCachedAuthSession(supabaseUrl: string | undefined) {
  if (!supabaseUrl) return null;
  const storageKey = defaultSupabaseAuthStorageKey(supabaseUrl);
  if (!storageKey) return null;

  try {
    return parseCachedAuthSession(localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}
