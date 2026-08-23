import { supabase } from '@/lib/supabase';
import { Link, useRouter } from 'expo-router';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';

const logo = require('../../assets/images/Bicreaderlogo-large.png');

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleSignIn = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.replace('/HomePage');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.decorativeCircle} />

          <View style={styles.header}>
            <Image source={logo} style={styles.logo} />
            <Text style={styles.brand}>Bic Reader</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to continue reading, learning, and exploring.
            </Text>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email address</Text>
                <View style={styles.inputShell}>
                  <Mail color="#737270" size={20} strokeWidth={1.8} />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#9E9C93"
                    returnKeyType="next"
                    style={styles.input}
                    value={email}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Password</Text>
                  <Link href="/(auth)/forgot-password" asChild>
                    <Pressable hitSlop={10}>
                      <Text style={styles.forgotPassword}>Forgot password?</Text>
                    </Pressable>
                  </Link>
                </View>
                <View style={styles.inputShell}>
                  <LockKeyhole color="#737270" size={20} strokeWidth={1.8} />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="current-password"
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#9E9C93"
                    returnKeyType="done"
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    value={password}
                  />
                  <Pressable
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={10}
                    onPress={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? (
                      <EyeOff color="#737270" size={20} />
                    ) : (
                      <Eye color="#737270" size={20} />
                    )}
                  </Pressable>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                onPress={() => void handleSignIn()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  !canSubmit && styles.primaryButtonDisabled,
                  pressed && canSubmit && styles.primaryButtonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Signing in…' : 'Sign in'}
                </Text>
              </Pressable>
              {errorMessage ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {errorMessage}
                </Text>
              ) : null}
            </View>

            <SocialAuthButtons disabled={isSubmitting} onError={setErrorMessage} />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>New to Bic Reader?</Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable hitSlop={8}>
                  <Text style={styles.switchLink}>Create an account</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: isDark ? '#10120F' : '#F7F5EF' },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
    overflow: 'hidden',
  },
  decorativeCircle: {
    position: 'absolute',
    top: -120,
    right: -105,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: isDark ? '#273321' : '#EAF3DE',
  },
  header: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 72, height: 72, borderRadius: 20 },
  brand: {
    marginTop: 8,
    color: isDark ? '#8FB85E' : '#2E5A0D',
    fontFamily: 'Lato_700Bold',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: isDark ? '#343A31' : '#E5E2D8',
    borderRadius: 28,
    backgroundColor: isDark ? '#1A1E18' : '#FFFEFB',
    shadowColor: '#173404',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  title: {
    color: isDark ? '#F4F5F1' : '#2C2C2A',
    fontFamily: 'Lato_700Bold',
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    marginTop: 8,
    color: isDark ? '#A6ADA1' : '#737270',
    fontFamily: 'Lato_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  form: { gap: 18, marginTop: 28 },
  fieldGroup: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: isDark ? '#E5E8E1' : '#444441', fontFamily: 'Lato_700Bold', fontSize: 14 },
  forgotPassword: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 13 },
  inputShell: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: isDark ? '#42483F' : '#D3D1C7',
    borderRadius: 16,
    backgroundColor: isDark ? '#222720' : '#FAFAF8',
  },
  input: {
    flex: 1,
    height: '100%',
    color: isDark ? '#F4F5F1' : '#2C2C2A',
    fontFamily: 'Lato_400Regular',
    fontSize: 16,
  },
  primaryButton: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: '#4F7D1A',
  },
  primaryButtonDisabled: { backgroundColor: '#AFC59A' },
  primaryButtonPressed: { backgroundColor: '#3B6D11', transform: [{ scale: 0.99 }] },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Lato_700Bold',
    fontSize: 16,
  },
  errorText: {
    color: '#B42318',
    fontFamily: 'Lato_400Regular',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 26,
  },
  switchText: { color: isDark ? '#A6ADA1' : '#737270', fontFamily: 'Lato_400Regular', fontSize: 14 },
  switchLink: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 14 },
});
