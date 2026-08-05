import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { usePdfLibrary } from '@/hooks/usePdfLibrary';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  BookCheck,
  BookOpen,
  ChevronRight,
  Library,
  LogOut,
  Mail,
  UserRound,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Profile() {
  const { session, signOut } = useAuth();
  const { pdfs, isLoading: isLibraryLoading } = usePdfLibrary();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const userId = session?.user.id;
  const email = session?.user.email ?? '';

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    void supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) return;

        if (error) {
          setErrorMessage(error.message);
        } else {
          const name = data?.full_name ?? '';
          setFullName(name);
          setSavedName(name);
        }

        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

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

  const canSave = fullName.trim().length > 0 && fullName.trim() !== savedName && !isSaving;

  const handleSave = async () => {
    if (!userId) return;

    const nextName = fullName.trim();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: nextName })
      .eq('id', userId);

    setIsSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setFullName(nextName);
    setSavedName(nextName);
    setSuccessMessage('Profile updated.');
  };

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Back to library"
              hitSlop={10}
              onPress={() => router.back()}
              style={styles.iconButton}
            >
              <ArrowLeft color="#2C2C2A" size={22} />
            </Pressable>
            <Text style={styles.headerTitle}>Account</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.identityCard}>
            <Text style={styles.identityName}>{savedName || 'Bic Reader member'}</Text>
            <Text style={styles.identityEmail}>{email}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile information</Text>
            {isLoading ? (
              <ActivityIndicator color="#4F7D1A" style={styles.loader} />
            ) : (
              <View style={styles.card}>
                <Text style={styles.label}>Full name</Text>
                <View style={styles.inputShell}>
                  <UserRound color="#737270" size={20} strokeWidth={1.8} />
                  <TextInput
                    autoCapitalize="words"
                    autoComplete="name"
                    maxLength={100}
                    onChangeText={(value) => {
                      setFullName(value);
                      setSuccessMessage(null);
                    }}
                    placeholder="Your name"
                    placeholderTextColor="#9E9C93"
                    returnKeyType="done"
                    style={styles.input}
                    value={fullName}
                  />
                </View>

                <Text style={[styles.label, styles.emailLabel]}>Email address</Text>
                <View style={[styles.inputShell, styles.readOnlyInput]}>
                  <Mail color="#888780" size={20} strokeWidth={1.8} />
                  <Text style={styles.readOnlyText}>{email}</Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  disabled={!canSave}
                  onPress={() => void handleSave()}
                  style={({ pressed }) => [
                    styles.saveButton,
                    !canSave && styles.saveButtonDisabled,
                    pressed && canSave && styles.saveButtonPressed,
                  ]}
                >
                  <Text style={styles.saveButtonText}>
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </Text>
                </Pressable>

                {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
              </View>
            )}
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
      </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F7F5EF' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 22, paddingBottom: 44 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0DDD3',
    borderRadius: 14,
    backgroundColor: '#FFFEFB',
  },
  headerTitle: { color: '#2C2C2A', fontFamily: 'Lato_700Bold', fontSize: 21 },
  headerSpacer: { width: 44 },
  identityCard: { alignItems: 'center', marginTop: 30 },
  identityName: { color: '#2C2C2A', fontFamily: 'Lato_700Bold', fontSize: 22 },
  identityEmail: { marginTop: 4, color: '#737270', fontFamily: 'Lato_400Regular', fontSize: 14 },
  section: { marginTop: 30 },
  sectionTitle: { color: '#2C2C2A', fontFamily: 'Lato_700Bold', fontSize: 18 },
  sectionCaption: { marginTop: 2, color: '#888780', fontFamily: 'Lato_400Regular', fontSize: 12 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loader: { paddingVertical: 38 },
  card: {
    marginTop: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E2D8',
    borderRadius: 22,
    backgroundColor: '#FFFEFB',
  },
  label: { color: '#444441', fontFamily: 'Lato_700Bold', fontSize: 14 },
  emailLabel: { marginTop: 17 },
  inputShell: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#D3D1C7',
    borderRadius: 15,
    backgroundColor: '#FAFAF8',
  },
  readOnlyInput: { backgroundColor: '#F1EFE8' },
  input: { flex: 1, height: '100%', color: '#2C2C2A', fontFamily: 'Lato_400Regular', fontSize: 16 },
  readOnlyText: { flex: 1, color: '#737270', fontFamily: 'Lato_400Regular', fontSize: 15 },
  saveButton: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderRadius: 15,
    backgroundColor: '#4F7D1A',
  },
  saveButtonDisabled: { backgroundColor: '#AFC59A' },
  saveButtonPressed: { backgroundColor: '#3B6D11' },
  saveButtonText: { color: '#FFFFFF', fontFamily: 'Lato_700Bold', fontSize: 15 },
  successText: { marginTop: 10, color: '#2E5A0D', fontFamily: 'Lato_400Regular', fontSize: 13, textAlign: 'center' },
  libraryLink: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 8 },
  libraryLinkText: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 14 },
  statsGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: {
    flex: 1,
    minHeight: 132,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E2D8',
    borderRadius: 18,
    backgroundColor: '#FFFEFB',
  },
  statIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#EAF3DE',
  },
  statValue: { marginTop: 11, color: '#2C2C2A', fontFamily: 'Lato_700Bold', fontSize: 23 },
  statLoader: { alignSelf: 'flex-start', marginTop: 14 },
  statLabel: { marginTop: 3, color: '#737270', fontFamily: 'Lato_400Regular', fontSize: 12 },
  progressCard: {
    marginTop: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E2D8',
    borderRadius: 18,
    backgroundColor: '#FFFEFB',
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTitle: { color: '#444441', fontFamily: 'Lato_700Bold', fontSize: 14 },
  progressValue: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 15 },
  progressTrack: { height: 8, marginTop: 12, overflow: 'hidden', borderRadius: 4, backgroundColor: '#E5E2D8' },
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
    borderColor: '#F1B8B3',
    borderRadius: 16,
    backgroundColor: '#FFF8F7',
  },
  signOutButtonPressed: { backgroundColor: '#FEECEB' },
  signOutText: { color: '#B42318', fontFamily: 'Lato_700Bold', fontSize: 15 },
});
