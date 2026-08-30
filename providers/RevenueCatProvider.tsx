import { useAuth } from '@/providers/AuthProvider';
import type { CustomerInfo, PurchasesError, PurchasesPackage } from 'react-native-purchases';
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE } from 'react-native-purchases';
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
const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? 'pro';

let isConfigured = false;
let configuredUserId: string | null = null;
let isLogHandlerConfigured = false;

function configureRevenueCatLogging() {
  if (isLogHandlerConfigured) return;

  Purchases.setLogHandler((level, message) => {
    const formattedMessage = `[RevenueCat] ${message}`;
    const isEmptyOfferingsConfiguration =
      message.includes('Error fetching offerings') &&
      (message.includes('no App Store products registered') ||
        message.includes('offerings are empty'));

    // RevenueCat reports an empty dashboard Offering at ERROR level. That is
    // an actionable configuration warning, but it is not an application crash
    // and should not trigger Expo's development error overlay.
    if (isEmptyOfferingsConfiguration) {
      console.warn(formattedMessage);
      return;
    }

    switch (level) {
      case LOG_LEVEL.ERROR:
        console.error(formattedMessage);
        break;
      case LOG_LEVEL.WARN:
        console.warn(formattedMessage);
        break;
      case LOG_LEVEL.INFO:
        console.info(formattedMessage);
        break;
      case LOG_LEVEL.DEBUG:
      case LOG_LEVEL.VERBOSE:
        if (__DEV__) console.debug(formattedMessage);
        break;
    }
  });

  isLogHandlerConfigured = true;
}

type RevenueCatContextValue = {
  error: string | null;
  isLoading: boolean;
  isPremium: boolean;
  loadPackages: () => Promise<PurchasesPackage[]>;
  purchasePackage: (selectedPackage: PurchasesPackage) => Promise<'purchased' | 'cancelled' | 'failed'>;
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

    if (!API_KEY) {
      setError('RevenueCat API key is missing.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      try {
        setIsLoading(true);
        const userId = session?.user.id ?? null;

        if (!isConfigured) {
          configureRevenueCatLogging();
          Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
          Purchases.configure({ apiKey: API_KEY, ...(userId ? { appUserID: userId } : {}) });
          isConfigured = true;
          configuredUserId = userId;
          if (isMounted) setIsReady(true);
        } else if (userId && configuredUserId !== userId) {
          const { customerInfo } = await Purchases.logIn(userId);
          configuredUserId = userId;
          if (isMounted) {
            setIsReady(true);
            applyCustomerInfo(customerInfo);
          }
          return;
        } else if (!userId && configuredUserId) {
          const customerInfo = await Purchases.logOut();
          configuredUserId = null;
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

  const loadPackages = useCallback(async () => {
    if (!isConfigured || Platform.OS === 'web') return [];
    try {
      setError(null);
      return (await Purchases.getOfferings()).current?.availablePackages ?? [];
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load subscriptions.');
      return [];
    }
  }, []);

  const purchasePackage = useCallback(async (selectedPackage: PurchasesPackage) => {
    if (!isConfigured || Platform.OS === 'web') return 'failed' as const;
    try {
      setError(null);
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      applyCustomerInfo(customerInfo);
      return hasPremiumEntitlement(customerInfo) ? 'purchased' as const : 'failed' as const;
    } catch (caughtError) {
      const purchaseError = caughtError as Partial<PurchasesError>;
      if (
        purchaseError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
        purchaseError.userCancelled
      ) {
        return 'cancelled' as const;
      }
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to complete purchase.');
      return 'failed' as const;
    }
  }, [applyCustomerInfo]);

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
    () => ({ error, isLoading, isPremium, loadPackages, purchasePackage, refreshCustomerInfo, restorePurchases, showPaywall }),
    [error, isLoading, isPremium, loadPackages, purchasePackage, refreshCustomerInfo, restorePurchases, showPaywall],
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat() {
  const value = useContext(RevenueCatContext);
  if (!value) throw new Error('useRevenueCat must be used inside RevenueCatProvider.');
  return value;
}
