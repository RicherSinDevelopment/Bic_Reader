import { useAuth } from '@/providers/AuthProvider';
import type { CustomerInfo } from 'react-native-purchases';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useSegments } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? 'premium';

let isConfigured = false;
let configuredUserId: string | null = null;

type RevenueCatContextValue = {
  error: string | null;
  isLoading: boolean;
  isPremium: boolean;
  refreshCustomerInfo: () => Promise<void>;
  restorePurchases: () => Promise<boolean>;
  showPaywall: () => Promise<boolean>;
};

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

function hasPremiumEntitlement(customerInfo: CustomerInfo) {
  return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

export function RevenueCatProvider({ children }: PropsWithChildren) {
  const { isLoading: isAuthLoading, session } = useAuth();
  const segments = useSegments();
  const isAuthActionRoute = segments[0] === 'auth';
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyCustomerInfo = useCallback((customerInfo: CustomerInfo) => {
    setIsPremium(hasPremiumEntitlement(customerInfo));
    setError(null);
    setIsLoading(false);
  }, []);

  const refreshCustomerInfo = useCallback(async () => {
    if (!isConfigured || Platform.OS === 'web') return;

    try {
      setIsLoading(true);
      applyCustomerInfo(await Purchases.getCustomerInfo());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to check subscription.');
      setIsLoading(false);
    }
  }, [applyCustomerInfo]);

  useEffect(() => {
    if (isAuthLoading) return;

    // Password-recovery links create a temporary authenticated session. Do not
    // initialize purchases while that session is only being used to set a new
    // password; purchase setup belongs to the app routes after recovery.
    if (isAuthActionRoute) {
      setIsLoading(false);
      return;
    }

    if (Platform.OS === 'web') {
      setIsLoading(false);
      return;
    }

    const userId = session?.user.id;
    if (!userId) {
      setIsPremium(false);
      setIsLoading(false);
      return;
    }

    if (!API_KEY) {
      setError('RevenueCat API key is missing.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      try {
        setIsLoading(true);

        if (!isConfigured) {
          Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
          Purchases.configure({ apiKey: API_KEY, appUserID: userId });
          isConfigured = true;
          configuredUserId = userId;
          if (isMounted) setIsReady(true);
        } else if (configuredUserId !== userId) {
          const { customerInfo } = await Purchases.logIn(userId);
          configuredUserId = userId;
          if (isMounted) {
            setIsReady(true);
            applyCustomerInfo(customerInfo);
          }
          return;
        } else if (isMounted) {
          setIsReady(true);
        }

        const customerInfo = await Purchases.getCustomerInfo();
        if (isMounted) applyCustomerInfo(customerInfo);
      } catch (caughtError) {
        if (!isMounted) return;
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to initialize purchases.');
        setIsLoading(false);
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [applyCustomerInfo, isAuthActionRoute, isAuthLoading, session?.user.id]);

  useEffect(() => {
    if (!isReady || Platform.OS === 'web') return;

    const listener = (customerInfo: CustomerInfo) => applyCustomerInfo(customerInfo);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo, isReady]);

  const showPaywall = useCallback(async () => {
    if (!isConfigured || Platform.OS === 'web') {
      setError('Purchases are available in the iOS or Android app.');
      return false;
    }

    try {
      setError(null);
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
      });
      await refreshCustomerInfo();
      return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to open the paywall.');
      return false;
    }
  }, [refreshCustomerInfo]);

  const restorePurchases = useCallback(async () => {
    if (!isConfigured || Platform.OS === 'web') {
      setError('Purchases are available in the iOS or Android app.');
      return false;
    }

    try {
      setIsLoading(true);
      const customerInfo = await Purchases.restorePurchases();
      applyCustomerInfo(customerInfo);
      return hasPremiumEntitlement(customerInfo);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to restore purchases.');
      setIsLoading(false);
      return false;
    }
  }, [applyCustomerInfo]);

  const value = useMemo<RevenueCatContextValue>(
    () => ({ error, isLoading, isPremium, refreshCustomerInfo, restorePurchases, showPaywall }),
    [error, isLoading, isPremium, refreshCustomerInfo, restorePurchases, showPaywall],
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat() {
  const value = useContext(RevenueCatContext);
  if (!value) throw new Error('useRevenueCat must be used inside RevenueCatProvider.');
  return value;
}
