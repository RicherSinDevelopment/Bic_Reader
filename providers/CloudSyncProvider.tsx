import { syncPremiumLibrary } from "@/services/cloudSyncService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useRevenueCat } from "@/providers/RevenueCatProvider";
import { useSQLiteContext } from "expo-sqlite";
import {
  AppState,
  type AppStateStatus,
} from "react-native";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type CloudSyncContextValue = {
  isSyncing: boolean;
  lastError: string | null;
  revision: number;
  syncNow: () => Promise<void>;
};

const CloudSyncContext = createContext<CloudSyncContextValue>({
  isSyncing: false,
  lastError: null,
  revision: 0,
  syncNow: async () => undefined,
});

export function CloudSyncProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const { session } = useAuth();
  const { isLoading: premiumLoading, isPremium } = useRevenueCat();
  const restoredUser = useRef<string | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const syncNow = useCallback(async () => {
    if (!session || premiumLoading || !isPremium) return;
    if (running.current) return running.current;
    const restoreFirst = restoredUser.current !== session.user.id;
    const task = (async () => {
      setIsSyncing(true);
      try {
        if (restoreFirst) {
          const { error: verificationError } = await supabase.functions.invoke(
            "verify-premium",
          );
          if (verificationError) throw verificationError;
        }
        const result = await syncPremiumLibrary(db, session, restoreFirst);
        restoredUser.current = session.user.id;
        setLastError(
          result.skippedOversizeDocuments.length
            ? `Cloud sync skipped ${result.skippedOversizeDocuments.length} PDF${result.skippedOversizeDocuments.length === 1 ? "" : "s"} over the 100 MB limit.`
            : null,
        );
        setRevision((value) => value + 1);
      } catch (error) {
        setLastError(error instanceof Error ? error.message : "Cloud sync failed.");
        console.warn("Premium cloud sync failed:", error);
      } finally {
        setIsSyncing(false);
        running.current = null;
      }
    })();
    running.current = task;
    return task;
  }, [db, isPremium, premiumLoading, session]);

  useEffect(() => {
    if (!session || premiumLoading || !isPremium) {
      restoredUser.current = null;
      return;
    }
    void syncNow();
    const interval = setInterval(() => void syncNow(), 30_000);
    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "background" || state === "inactive") void syncNow();
      },
    );
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [isPremium, premiumLoading, session, syncNow]);

  const value = useMemo(
    () => ({ isSyncing, lastError, revision, syncNow }),
    [isSyncing, lastError, revision, syncNow],
  );
  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}

export function useCloudSync() {
  return useContext(CloudSyncContext);
}
