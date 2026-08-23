import { useAuth } from '@/providers/AuthProvider';
import { useRevenueCat } from '@/providers/RevenueCatProvider';
import { usePdfLibrary } from '@/hooks/usePdfLibrary';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  BookCheck,
  BookOpen,
  ChevronRight,
  Library,
  LogOut,
  Moon,
  RefreshCw,
  Sparkles,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Profile() {
  const { signOut } = useAuth();
  const {
    error: purchaseError,
    isLoading: isSubscriptionLoading,
    isPremium,
    restorePurchases,
    showPaywall,
  } = useRevenueCat();
  const { pdfs, isLoading: isLibraryLoading } = usePdfLibrary();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Back to library"
              hitSlop={10}
              onPress={() => router.back()}
              style={styles.iconButton}
            >
              <ArrowLeft color={isDark ? '#F4F5F1' : '#2C2C2A'} size={22} />
            </Pressable>
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
                  onPress={() => void showPaywall()}
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
                disabled={isSubscriptionLoading}
                onPress={() => void restorePurchases()}
                style={styles.restoreButton}
              >
                <RefreshCw color="#4F7D1A" size={17} />
                <Text style={styles.restoreButtonText}>Restore purchases</Text>
              </Pressable>

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
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDark ? '#343A31' : '#E0DDD3',
    borderRadius: 14,
    backgroundColor: isDark ? '#1A1E18' : '#FFFEFB',
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
  restoreButtonText: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 14 },
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
  errorText: { marginTop: 18, color: '#B42318', fontFamily: 'Lato_400Regular', fontSize: 13, textAlign: 'center' },
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
