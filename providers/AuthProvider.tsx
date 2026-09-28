import type { Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { supabase, supabaseUrl } from '@/lib/supabase';
import { readCachedAuthSession } from '@/services/cachedAuthSession';

const OFFLINE_STARTUP_FALLBACK_MS = 1_000;

type AuthContextValue = {
  isLoading: boolean;
  session: Session | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [cachedSession] = useState(() => readCachedAuthSession(supabaseUrl));
  const [session, setSession] = useState<Session | null>(cachedSession);
  const [isLoading, setIsLoading] = useState(!cachedSession);

  useEffect(() => {
    let isMounted = true;

    // getSession can refresh an expiring token over the network. Render from
    // the persisted session immediately, and never let an offline refresh hold
    // the entire application on its startup loading screen.
    const fallback = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, OFFLINE_STARTUP_FALLBACK_MS);

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (data.session) setSession(data.session);
      else if (!error) setSession(null);
      setIsLoading(false);
      clearTimeout(fallback);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(fallback);
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      session,
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}
