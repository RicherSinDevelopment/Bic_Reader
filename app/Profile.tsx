import { useAuth } from '@/providers/AuthProvider';
import { useRevenueCat } from '@/providers/RevenueCatProvider';
import { usePdfLibrary } from '@/hooks/usePdfLibrary';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { resetOnboarding } from '@/lib/onboarding';
import ProfileBackButton from '@/components/ProfileBackButton';
import { useRouter } from 'expo-router';
import {
  BookCheck,
  BookOpen,
  ChevronRight,
  Globe2,
  Library,
  LogOut,
  Mail,
  Moon,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { deleteCurrentAccount } from '@/services/accountDeletionService';

const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

export default function Profile() {
  const { signOut } = useAuth();
  const {
    error: purchaseError,
    isLoading: isSubscriptionLoading,
    isPremium,
    restorePurchases,
  } = useRevenueCat();
  const { pdfs, isLoading: isLibraryLoading } = usePdfLibrary();
  const db = useSQLiteContext();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const preference = useAppearanceStore((state) => state.preference);
  const setPreference = useAppearanceStore((state) => state.setPreference);
  const isDark = useColorScheme() === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const stats = useMemo(() => {
    const completed = pdfs.filter((pdf) => pdf.completionPercentage >= 100).length;
    const inProgress = pdfs.filter(
      (pdf) => pdf.completionPercentage > 0 && pdf.completionPercentage < 100,
    ).length;
    const averageProgress = pdfs.length
      ? Math.round(
          pdfs.reduce((total, pdf) => total + pdf.completionPercentage, 0) / pdfs.length,
        )
      : 0;

    return { completed, inProgress, averageProgress };
  }, [pdfs]);

  const handleSignOut = async () => {
    setErrorMessage(null);

    try {
      resetOnboarding();
      await signOut();
      router.replace('/onboarding');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  const handleRestorePurchases = async () => {
    if (isRestoring) return;
    setErrorMessage(null);
    setRestoreMessage(null);
    setIsRestoring(true);

    const restored = await restorePurchases();
    setIsRestoring(false);
    setRestoreMessage(
      restored
        ? 'Premium restored successfully.'
        : 'No active Premium subscription was found for this store account.',
    );
  };

  const openExternalLink = async (url: string, fallbackMessage: string) => {
    setErrorMessage(null);
    try {
      await Linking.openURL(url);
    } catch {
      setErrorMessage(fallbackMessage);
    }
  };

  const deleteAccount = async () => {
    if (isDeletingAccount) return;
    setErrorMessage(null);
    setIsDeletingAccount(true);
    try {
      await deleteCurrentAccount(db);
      resetOnboarding();
      router.replace('/onboarding');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete your account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const confirmPermanentDeletion = () => {
    Alert.alert(
      'Permanently delete account?',
      'This cannot be undone. Your account, cloud PDFs, cloud annotations, settings, subscription profile, and local annotations and AI conversations will be deleted. PDFs saved on this device will remain available offline.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete permanently', style: 'destructive', onPress: () => void deleteAccount() },
      ],
    );
  };

  const requestAccountDeletion = () => {
    const message = isPremium
      ? 'Deleting your Bic Reader account does not cancel billing through Apple. Manage or cancel your subscription first if you do not want it to renew.'
      : 'Deleting your account permanently removes your Bic Reader cloud data. PDFs stored locally on this device will remain available offline.';
    const buttons = isPremium
      ? [
          { text: 'Cancel', style: 'cancel' as const },
          {
            text: 'Manage Subscription',
            onPress: () => void openExternalLink(APPLE_SUBSCRIPTIONS_URL, 'Unable to open Apple subscription settings.'),
          },
          { text: 'Continue', style: 'destructive' as const, onPress: confirmPermanentDeletion },
        ]
      : [
          { text: 'Cancel', style: 'cancel' as const },
          { text: 'Continue', style: 'destructive' as const, onPress: confirmPermanentDeletion },
        ];
    Alert.alert('Delete account', message, buttons);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitle}>Settings</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            <View style={styles.appearanceCard}>
              <View style={styles.appearanceIcon}>
                <Moon color="#639922" size={21} />
              </View>
              <View style={styles.appearanceCopy}>
                <Text style={styles.appearanceTitle}>Dark mode</Text>
                <Text style={styles.appearanceCaption}>
                  {preference === 'system'
                    ? 'Following your device setting'
                    : preference === 'dark'
                      ? 'Always use dark appearance'
                      : 'Always use light appearance'}
                </Text>
              </View>
              <View style={styles.appearanceSwitchContainer}>
                <Switch
                  accessibilityLabel="Dark mode"
                  onValueChange={(enabled) =>
                    setPreference(enabled ? 'dark' : 'light')
                  }
                  style={styles.appearanceSwitch}
                  trackColor={{ false: '#C9CDC5', true: '#639922' }}
                  thumbColor="#FFFFFF"
                  value={isDark}
                />
              </View>
            </View>
            {preference !== 'system' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setPreference('system')}
                style={styles.systemAppearanceButton}
              >
                <Text style={styles.systemAppearanceText}>
                  Use device setting
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Membership</Text>
            <View style={styles.membershipCard}>
              <View style={styles.membershipHeading}>
                <View style={styles.membershipIcon}>
                  <Sparkles color="#4F7D1A" size={22} />
                </View>
                <View style={styles.membershipCopy}>
                  <Text style={styles.membershipTitle}>
                    {isSubscriptionLoading
                      ? 'Checking membership…'
                      : isPremium
                        ? 'Premium'
                        : 'Free plan'}
                  </Text>
                  <Text style={styles.membershipCaption}>
                    {isPremium
                      ? 'Your premium features are unlocked.'
                      : 'Upgrade to unlock premium features.'}
                  </Text>
                </View>
              </View>

              {!isPremium ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubscriptionLoading}
                  onPress={() => router.push({ pathname: '/onboarding/premium', params: { source: 'app' } })}
                  style={({ pressed }) => [
                    styles.upgradeButton,
                    isSubscriptionLoading && styles.saveButtonDisabled,
                    pressed && !isSubscriptionLoading && styles.saveButtonPressed,
                  ]}
                >
                  <Text style={styles.saveButtonText}>Upgrade to Premium</Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={isSubscriptionLoading || isRestoring}
                onPress={() => void handleRestorePurchases()}
                style={({ pressed }) => [
                  styles.restoreButton,
                  (isSubscriptionLoading || isRestoring) && styles.restoreButtonDisabled,
                  pressed && !isSubscriptionLoading && !isRestoring && styles.restoreButtonPressed,
                ]}
              >
                {isRestoring ? (
                  <ActivityIndicator color="#4F7D1A" size="small" />
                ) : (
                  <RefreshCw color="#4F7D1A" size={17} />
                )}
                <Text style={styles.restoreButtonText}>
                  {isRestoring ? 'Restoring…' : 'Restore purchases'}
                </Text>
              </Pressable>

              {restoreMessage ? (
                <Text
                  accessibilityRole="alert"
                  style={isPremium ? styles.successText : styles.restoreNoticeText}
                >
                  {restoreMessage}
                </Text>
              ) : null}
              {purchaseError ? <Text style={styles.errorText}>{purchaseError}</Text> : null}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionTitle}>Reading activity</Text>
                <Text style={styles.sectionCaption}>On this device</Text>
              </View>
              <Pressable onPress={() => router.replace('/HomePage')} style={styles.libraryLink}>
                <Text style={styles.libraryLinkText}>Library</Text>
                <ChevronRight color="#4F7D1A" size={17} />
              </Pressable>
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                icon={<Library color="#4F7D1A" size={22} />}
                label="PDFs"
                loading={isLibraryLoading}
                value={pdfs.length}
              />
              <StatCard
                icon={<BookOpen color="#4F7D1A" size={22} />}
                label="In progress"
                loading={isLibraryLoading}
                value={stats.inProgress}
              />
              <StatCard
                icon={<BookCheck color="#4F7D1A" size={22} />}
                label="Completed"
                loading={isLibraryLoading}
                value={stats.completed}
              />
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Average progress</Text>
                <Text style={styles.progressValue}>{stats.averageProgress}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${stats.averageProgress}%` }]} />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            <View style={styles.supportCard}>
              <Pressable
                accessibilityHint="Opens your email app"
                accessibilityRole="link"
                onPress={() => void openExternalLink(
                  'mailto:support@bicreader.com?subject=Bic%20Reader%20Support',
                  'Unable to open your email app. Email support@bicreader.com directly.',
                )}
                style={({ pressed }) => [styles.supportRow, pressed && styles.supportRowPressed]}
              >
                <View style={styles.supportIcon}>
                  <Mail color="#4F7D1A" size={20} />
                </View>
                <View style={styles.supportCopy}>
                  <Text style={styles.supportTitle}>Contact us</Text>
                  <Text style={styles.supportCaption}>support@bicreader.com</Text>
                </View>
                <ChevronRight color={isDark ? '#7F897A' : '#9A9D95'} size={19} />
              </Pressable>

              <View style={styles.supportDivider} />

              <Pressable
                accessibilityHint="Opens the Bic Reader website"
                accessibilityRole="link"
                onPress={() => void openExternalLink(
                  'https://bicreader.com',
                  'Unable to open bicreader.com.',
                )}
                style={({ pressed }) => [styles.supportRow, pressed && styles.supportRowPressed]}
              >
                <View style={styles.supportIcon}>
                  <Globe2 color="#4F7D1A" size={20} />
                </View>
                <View style={styles.supportCopy}>
                  <Text style={styles.supportTitle}>Visit our website</Text>
                  <Text style={styles.supportCaption}>bicreader.com</Text>
                </View>
                <ChevronRight color={isDark ? '#7F897A' : '#9A9D95'} size={19} />
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.dangerCard}>
              <Text style={styles.dangerTitle}>Delete account</Text>
              <Text style={styles.dangerCaption}>
                Permanently remove your account and associated cloud data. Your offline PDF files will remain on this device.
              </Text>
              {isPremium ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void openExternalLink(APPLE_SUBSCRIPTIONS_URL, 'Unable to open Apple subscription settings.')}
                  style={styles.manageSubscriptionButton}
                >
                  <Text style={styles.manageSubscriptionText}>Manage Apple subscription</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityHint="Permanently deletes your account and associated data"
                accessibilityRole="button"
                disabled={isDeletingAccount}
                onPress={requestAccountDeletion}
                style={({ pressed }) => [
                  styles.deleteAccountButton,
                  isDeletingAccount && styles.deleteAccountButtonDisabled,
                  pressed && !isDeletingAccount && styles.deleteAccountButtonPressed,
                ]}
              >
                {isDeletingAccount ? <ActivityIndicator color="#B42318" size="small" /> : <Trash2 color="#B42318" size={18} />}
                <Text style={styles.deleteAccountText}>{isDeletingAccount ? 'Deleting account…' : 'Delete account'}</Text>
              </Pressable>
            </View>
          </View>

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => void handleSignOut()}
            style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
          >
            <LogOut color="#B42318" size={20} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
      </ScrollView>
      <View pointerEvents="box-none" style={styles.persistentBackOverlay}>
        <View pointerEvents="box-none" style={styles.persistentBackContent}>
          <ProfileBackButton onPress={() => router.back()} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  loading,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  value: number;
}) {
  const isDark = useColorScheme() === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>
      {loading ? (
        <ActivityIndicator color="#4F7D1A" size="small" style={styles.statLoader} />
      ) : (
        <Text style={styles.statValue}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: isDark ? '#10120F' : '#F7F5EF' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 22, paddingBottom: 44 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  persistentBackOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 20,
  },
  persistentBackContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 22,
    alignItems: 'flex-start',
  },
  headerTitle: { color: isDark ? '#F4F5F1' : '#2C2C2A', fontFamily: 'Lato_700Bold', fontSize: 21 },
  headerSpacer: { width: 44 },
  section: { marginTop: 30 },
  sectionTitle: { color: isDark ? '#F4F5F1' : '#2C2C2A', fontFamily: 'Lato_700Bold', fontSize: 18 },
  sectionCaption: { marginTop: 2, color: isDark ? '#9EA69A' : '#888780', fontFamily: 'Lato_400Regular', fontSize: 12 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appearanceCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: isDark ? '#343A31' : '#E5E2D8',
    borderRadius: 20,
    backgroundColor: isDark ? '#1A1E18' : '#FFFEFB',
  },
  appearanceIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: isDark ? '#273321' : '#EAF3DE',
  },
  appearanceCopy: { flex: 1, minWidth: 0 },
  appearanceSwitchContainer: {
    width: 54,
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  appearanceSwitch: { transform: [{ scaleX: 0.92 }, { scaleY: 0.92 }] },
  appearanceTitle: {
    color: isDark ? '#F4F5F1' : '#2C2C2A',
    fontFamily: 'Lato_700Bold',
    fontSize: 16,
  },
  appearanceCaption: {
    marginTop: 3,
    color: isDark ? '#A6ADA1' : '#737270',
    fontFamily: 'Lato_400Regular',
    fontSize: 12,
  },
  systemAppearanceButton: { alignSelf: 'flex-start', marginTop: 9, padding: 6 },
  systemAppearanceText: {
    color: '#639922',
    fontFamily: 'Lato_700Bold',
    fontSize: 13,
  },
  saveButtonDisabled: { backgroundColor: '#AFC59A' },
  saveButtonPressed: { backgroundColor: '#3B6D11' },
  saveButtonText: { color: '#FFFFFF', fontFamily: 'Lato_700Bold', fontSize: 15 },
  membershipCard: {
    marginTop: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: isDark ? '#304426' : '#DCE8CC',
    borderRadius: 22,
    backgroundColor: isDark ? '#182016' : '#F9FDF4',
  },
  membershipHeading: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  membershipIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: isDark ? '#273321' : '#EAF3DE',
  },
  membershipCopy: { flex: 1 },
  membershipTitle: { color: isDark ? '#F4F5F1' : '#2C2C2A', fontFamily: 'Lato_700Bold', fontSize: 17 },
  membershipCaption: { marginTop: 3, color: isDark ? '#A6ADA1' : '#737270', fontFamily: 'Lato_400Regular', fontSize: 13 },
  upgradeButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    borderRadius: 15,
    backgroundColor: '#4F7D1A',
  },
  restoreButton: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 8,
  },
  restoreButtonDisabled: { opacity: 0.58 },
  restoreButtonPressed: { opacity: 0.72 },
  restoreButtonText: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 14 },
  successText: { marginTop: 3, color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 13, textAlign: 'center' },
  restoreNoticeText: { marginTop: 3, color: isDark ? '#B8BEB3' : '#737270', fontFamily: 'Lato_400Regular', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  libraryLink: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 8 },
  libraryLinkText: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 14 },
  statsGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: {
    flex: 1,
    minHeight: 132,
    padding: 14,
    borderWidth: 1,
    borderColor: isDark ? '#343A31' : '#E5E2D8',
    borderRadius: 18,
    backgroundColor: isDark ? '#1A1E18' : '#FFFEFB',
  },
  statIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: isDark ? '#273321' : '#EAF3DE',
  },
  statValue: { marginTop: 11, color: isDark ? '#F4F5F1' : '#2C2C2A', fontFamily: 'Lato_700Bold', fontSize: 23 },
  statLoader: { alignSelf: 'flex-start', marginTop: 14 },
  statLabel: { marginTop: 3, color: isDark ? '#A6ADA1' : '#737270', fontFamily: 'Lato_400Regular', fontSize: 12 },
  progressCard: {
    marginTop: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: isDark ? '#343A31' : '#E5E2D8',
    borderRadius: 18,
    backgroundColor: isDark ? '#1A1E18' : '#FFFEFB',
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTitle: { color: isDark ? '#E5E8E1' : '#444441', fontFamily: 'Lato_700Bold', fontSize: 14 },
  progressValue: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 15 },
  progressTrack: { height: 8, marginTop: 12, overflow: 'hidden', borderRadius: 4, backgroundColor: isDark ? '#343A31' : '#E5E2D8' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#639922' },
  supportCard: {
    marginTop: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDark ? '#343A31' : '#E5E2D8',
    borderRadius: 20,
    backgroundColor: isDark ? '#1A1E18' : '#FFFEFB',
  },
  supportRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 17,
  },
  supportRowPressed: { backgroundColor: isDark ? '#232820' : '#F3F5EE' },
  supportIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: isDark ? '#273321' : '#EAF3DE',
  },
  supportCopy: { flex: 1, minWidth: 0 },
  supportTitle: { color: isDark ? '#F4F5F1' : '#2C2C2A', fontFamily: 'Lato_700Bold', fontSize: 15 },
  supportCaption: { marginTop: 3, color: isDark ? '#A6ADA1' : '#737270', fontFamily: 'Lato_400Regular', fontSize: 12 },
  supportDivider: { height: StyleSheet.hairlineWidth, marginLeft: 70, backgroundColor: isDark ? '#343A31' : '#E5E2D8' },
  errorText: { marginTop: 18, color: '#B42318', fontFamily: 'Lato_400Regular', fontSize: 13, textAlign: 'center' },
  dangerCard: {
    marginTop: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: isDark ? '#673631' : '#F1B8B3',
    borderRadius: 20,
    backgroundColor: isDark ? '#241716' : '#FFF8F7',
  },
  dangerTitle: { color: isDark ? '#FFD7D3' : '#8F1D16', fontFamily: 'Lato_700Bold', fontSize: 16 },
  dangerCaption: { marginTop: 5, color: isDark ? '#D7B5B1' : '#76514E', fontFamily: 'Lato_400Regular', fontSize: 13, lineHeight: 19 },
  manageSubscriptionButton: { alignSelf: 'flex-start', paddingVertical: 12 },
  manageSubscriptionText: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 14 },
  deleteAccountButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: isDark ? '#8B4A43' : '#E69B94',
    borderRadius: 14,
  },
  deleteAccountButtonDisabled: { opacity: 0.55 },
  deleteAccountButtonPressed: { backgroundColor: isDark ? '#321E1C' : '#FEECEB' },
  deleteAccountText: { color: '#B42318', fontFamily: 'Lato_700Bold', fontSize: 14 },
  signOutButton: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 28,
    borderWidth: 1,
    borderColor: isDark ? '#673631' : '#F1B8B3',
    borderRadius: 16,
    backgroundColor: isDark ? '#241716' : '#FFF8F7',
  },
  signOutButtonPressed: { backgroundColor: isDark ? '#321E1C' : '#FEECEB' },
  signOutText: { color: '#B42318', fontFamily: 'Lato_700Bold', fontSize: 15 },
});
