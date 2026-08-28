import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { completeOnboarding } from '@/lib/onboarding';
import { OnboardingBackButton } from '@/components/onboarding/OnboardingBackButton';
import { useAuth } from '@/providers/AuthProvider';
import { useRevenueCat } from '@/providers/RevenueCatProvider';

const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

const premiumBenefits = [
  'Unlimited PDF library',
  'AI Assistant',
  'Cloud Sync',
];

const freeBenefits = ['Up to 5 PDFs', 'Reader Mode', 'Reading customization', 'Highlights'];

export default function PremiumOnboardingScreen() {
  const { source } = useLocalSearchParams<{ source?: string }>();
  const isOnboardingFlow = source !== 'app';
  const { session } = useAuth();
  const {
    isLoading: isMembershipLoading,
    isPremium,
    loadPackages,
    purchasePackage,
    restorePurchases,
  } = useRevenueCat();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isMembershipLoading) return;
    if (isPremium) {
      setIsLoadingPackages(false);
      return;
    }
    let isMounted = true;
    void loadPackages().then((availablePackages) => {
      if (!isMounted) return;
      setPackages(availablePackages);
      setSelectedPackageId(availablePackages[0]?.identifier ?? null);
      setIsLoadingPackages(false);
    });
    return () => { isMounted = false; };
  }, [isMembershipLoading, loadPackages]);

  const selectedPackage = useMemo(
    () => packages.find((item) => item.identifier === selectedPackageId) ?? packages[0],
    [packages, selectedPackageId],
  );

  const finishOnboarding = () => {
    completeOnboarding();
    router.replace(session ? '/HomePage' : '/(auth)/sign-in');
  };

  const handlePurchase = async () => {
    if (isPremium) {
      finishOnboarding();
      return;
    }
    if (!selectedPackage || isPurchasing) return;
    setMessage(null);
    setIsPurchasing(true);
    const result = await purchasePackage(selectedPackage);
    setIsPurchasing(false);
    if (result === 'purchased') finishOnboarding();
    if (result === 'failed') setMessage("We couldn't complete the purchase. Please try again.");
  };

  const handleRestore = async () => {
    if (isRestoring) return;
    setMessage(null);
    setIsRestoring(true);
    const restored = await restorePurchases();
    setIsRestoring(false);
    if (restored) finishOnboarding();
    else setMessage('No active Premium purchase was found for this App Store account.');
  };

  const packagesUnavailable = !isLoadingPackages && packages.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <OnboardingBackButton onPress={() => router.back()} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.copy}>
            <View style={styles.premiumIcon}>
              <Ionicons name="sparkles" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Unlock the full Bic Reader experience</Text>
            <Text style={styles.subtitle}>Read for free, or upgrade when you want more.</Text>
          </View>

          <View style={styles.premiumCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.planEyebrow}>BIC READER</Text>
                <Text style={styles.premiumTitle}>Premium</Text>
              </View>
              {isPremium ? (
                <View style={styles.activePill}>
                  <Ionicons name="checkmark-circle" size={15} color="#4F7D1A" />
                  <Text style={styles.activePillText}>Active</Text>
                </View>
              ) : null}
            </View>

            {isPremium ? (
              <Text style={styles.premiumActiveText}>
                Your Premium features are unlocked on this account.
              </Text>
            ) : isLoadingPackages || isMembershipLoading ? (
              <View style={styles.priceLoading}>
                <ActivityIndicator color="#639922" size="small" />
                <Text style={styles.priceLoadingText}>Loading App Store plans…</Text>
              </View>
            ) : packages.length > 0 ? (
              <View style={styles.packageSelector}>
                {packages.map((item) => (
                  <PackageOption
                    isSelected={item.identifier === selectedPackage?.identifier}
                    key={item.identifier}
                    onPress={() => setSelectedPackageId(item.identifier)}
                    selectedPackage={item}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.unavailableText}>
                Premium plans are temporarily unavailable. You can continue with the free plan.
              </Text>
            )}

            <View style={styles.benefitList}>
              {premiumBenefits.map((benefit) => (
                <Benefit key={benefit} label={benefit} premium />
              ))}
            </View>
          </View>

          <View style={styles.freeCard}>
            <View style={styles.freeHeading}>
              <Text style={styles.freeTitle}>Free</Text>
              <Text style={styles.freeCaption}>A complete, comfortable PDF reader</Text>
            </View>
            <View style={styles.freeBenefits}>
              {freeBenefits.map((benefit) => <Benefit key={benefit} label={benefit} />)}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={isPurchasing || (!isPremium && (!selectedPackage || packagesUnavailable))}
            onPress={() => void handlePurchase()}
            style={({ pressed }) => [
              styles.premiumButton,
              (isPurchasing || (!isPremium && !selectedPackage)) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {isPurchasing ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
            <Text style={styles.premiumButtonText}>
              {isPremium ? 'Continue' : isPurchasing ? 'Purchasing…' : 'Start Premium'}
            </Text>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={finishOnboarding} style={styles.continueFreeButton}>
            <Text style={styles.continueFreeText}>Continue Free</Text>
          </Pressable>

          <View style={styles.linkRow}>
            <Pressable disabled={isRestoring} onPress={() => void handleRestore()} hitSlop={8}>
              <Text style={styles.footerLink}>{isRestoring ? 'Restoring…' : 'Restore Purchases'}</Text>
            </Pressable>
            {TERMS_URL ? <Text style={styles.linkDivider}>•</Text> : null}
            {TERMS_URL ? <Pressable onPress={() => void Linking.openURL(TERMS_URL)}><Text style={styles.footerLink}>Terms</Text></Pressable> : null}
            {PRIVACY_URL ? <Text style={styles.linkDivider}>•</Text> : null}
            {PRIVACY_URL ? <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)}><Text style={styles.footerLink}>Privacy</Text></Pressable> : null}
          </View>

          {isOnboardingFlow ? (
            <View style={styles.pagination} accessibilityLabel="Onboarding page 5 of 5">
              <View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} /><View style={styles.activeDot} />
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

function PackageOption({ isSelected, onPress, selectedPackage }: { isSelected: boolean; onPress: () => void; selectedPackage: PurchasesPackage }) {
  return (
    <Pressable onPress={onPress} style={[styles.packageOption, isSelected && styles.packageOptionSelected]}>
      <View style={[styles.radio, isSelected && styles.radioSelected]}>{isSelected ? <View style={styles.radioCenter} /> : null}</View>
      <View style={styles.packageCopy}>
        <Text style={styles.packageName}>{packageName(selectedPackage)}</Text>
        <Text style={styles.packagePeriod}>{packagePeriod(selectedPackage)}</Text>
      </View>
      <Text style={styles.packagePrice}>{selectedPackage.product.priceString}</Text>
    </Pressable>
  );
}

function Benefit({ label, premium = false }: { label: string; premium?: boolean }) {
  return (
    <View style={styles.benefitRow}>
      <View style={[styles.check, premium && styles.premiumCheck]}>
        <Ionicons name="checkmark" size={12} color={premium ? '#FFFFFF' : '#639922'} />
      </View>
      <Text style={styles.benefitText}>{label}</Text>
    </View>
  );
}

function packageName(item: PurchasesPackage) {
  const names: Record<string, string> = { MONTHLY: 'Monthly', ANNUAL: 'Annual', WEEKLY: 'Weekly', LIFETIME: 'Lifetime' };
  if (names[item.packageType]) return names[item.packageType];
  if (item.product.subscriptionPeriod === 'P1M') return 'Monthly';
  if (item.product.subscriptionPeriod === 'P1Y') return 'Annual';
  return item.product.title;
}

function packagePeriod(item: PurchasesPackage) {
  const periods: Record<string, string> = { MONTHLY: 'per month', ANNUAL: 'per year', WEEKLY: 'per week', LIFETIME: 'one-time purchase' };
  if (periods[item.packageType]) return periods[item.packageType];
  if (item.product.subscriptionPeriod === 'P1M') return 'per month';
  if (item.product.subscriptionPeriod === 'P1Y') return 'per year';
  return 'subscription';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F5EC' },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 14 },
  copy: { alignItems: 'center', paddingTop: 12, paddingHorizontal: 18 },
  premiumIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#639922' },
  title: { maxWidth: 350, marginTop: 13, textAlign: 'center', color: '#1D221A', fontFamily: 'Lato_700Bold', fontSize: 29, lineHeight: 34, letterSpacing: -0.5 },
  subtitle: { marginTop: 8, textAlign: 'center', color: '#65705D', fontFamily: 'SourceSans3_400Regular', fontSize: 16, lineHeight: 22 },
  premiumCard: { marginTop: 20, borderWidth: 1.5, borderColor: '#8EAF64', borderRadius: 23, padding: 18, backgroundColor: '#FFFEFA', shadowColor: '#3E571F', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planEyebrow: { color: '#71963F', fontFamily: 'Lato_700Bold', fontSize: 9, letterSpacing: 1.3 },
  premiumTitle: { marginTop: 2, color: '#20251D', fontFamily: 'Lato_700Bold', fontSize: 23 },
  activePill: { borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ECF4E1' },
  activePillText: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 11 },
  priceLoading: { height: 54, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  priceLoadingText: { color: '#747C6C', fontFamily: 'SourceSans3_400Regular', fontSize: 14 },
  premiumActiveText: { marginTop: 13, color: '#4F6E2E', fontFamily: 'SourceSans3_400Regular', fontSize: 14, lineHeight: 20 },
  unavailableText: { marginTop: 12, color: '#747C6C', fontFamily: 'SourceSans3_400Regular', fontSize: 13, lineHeight: 18 },
  packageSelector: { marginTop: 13, gap: 8 },
  packageOption: { minHeight: 54, borderWidth: 1, borderColor: '#DFE2D9', borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#FAFAF7' },
  packageOptionSelected: { borderColor: '#7EA64A', backgroundColor: '#F1F6E9' },
  radio: { width: 18, height: 18, borderWidth: 1.5, borderColor: '#A8ADA2', borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#639922' },
  radioCenter: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#639922' },
  packageCopy: { flex: 1, marginLeft: 10 },
  packageName: { color: '#283025', fontFamily: 'Lato_700Bold', fontSize: 14 },
  packagePeriod: { marginTop: 1, color: '#7A8174', fontFamily: 'SourceSans3_400Regular', fontSize: 11 },
  packagePrice: { color: '#283025', fontFamily: 'Lato_700Bold', fontSize: 15 },
  benefitList: { marginTop: 15, gap: 9 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  check: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3E6' },
  premiumCheck: { backgroundColor: '#639922' },
  benefitText: { color: '#424A3D', fontFamily: 'SourceSans3_400Regular', fontSize: 14 },
  freeCard: { marginTop: 12, borderWidth: 1, borderColor: '#DFE1D9', borderRadius: 19, padding: 15, backgroundColor: '#F3F2EC' },
  freeHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  freeTitle: { color: '#30362C', fontFamily: 'Lato_700Bold', fontSize: 18 },
  freeCaption: { flex: 1, textAlign: 'right', color: '#777F71', fontFamily: 'SourceSans3_400Regular', fontSize: 12 },
  freeBenefits: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCDED6', paddingHorizontal: 20, paddingTop: 11, paddingBottom: 4, backgroundColor: '#F7F5EC' },
  message: { marginBottom: 8, textAlign: 'center', color: '#8A4E2D', fontFamily: 'SourceSans3_400Regular', fontSize: 12.5 },
  premiumButton: { height: 55, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#639922', shadowColor: '#4C741C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 11, elevation: 4 },
  buttonDisabled: { opacity: 0.48 },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  premiumButtonText: { color: '#FFFFFF', fontFamily: 'Lato_700Bold', fontSize: 17 },
  continueFreeButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  continueFreeText: { color: '#3F5F1E', fontFamily: 'Lato_700Bold', fontSize: 15 },
  linkRow: { minHeight: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerLink: { color: '#747C6D', fontFamily: 'SourceSans3_400Regular', fontSize: 12.5, textDecorationLine: 'underline' },
  linkDivider: { color: '#B0B4AB', fontSize: 11 },
  pagination: { height: 18, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  activeDot: { width: 22, height: 7, borderRadius: 4, backgroundColor: '#639922' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D4D8CE' },
});
