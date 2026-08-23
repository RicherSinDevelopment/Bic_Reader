import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const isDark = useColorScheme() === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const canSubmit = email.trim().length > 0 && !isSubmitting;

  const handleResetRequest = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('auth/reset-password'),
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setIsSent(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.card}>
          <View style={styles.iconShell}>
            <Mail color="#4F7D1A" size={30} strokeWidth={1.8} />
          </View>

          <Text style={styles.title}>{isSent ? 'Check your email' : 'Forgot your password?'}</Text>
          <Text style={styles.subtitle}>
            {isSent
              ? `If an account exists for ${email.trim()}, we sent instructions to reset its password.`
              : 'Enter your email and we’ll send you a secure password reset link.'}
          </Text>

          {!isSent ? (
            <View style={styles.form}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputShell}>
                <Mail color="#737270" size={20} strokeWidth={1.8} />
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  onSubmitEditing={() => canSubmit && void handleResetRequest()}
                  placeholder="you@example.com"
                  placeholderTextColor="#9E9C93"
                  returnKeyType="send"
                  style={styles.input}
                  value={email}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                onPress={() => void handleResetRequest()}
                style={({ pressed }) => [
                  styles.button,
                  !canSubmit && styles.buttonDisabled,
                  pressed && canSubmit && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonText}>
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </Text>
              </Pressable>

              {errorMessage ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {errorMessage}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Link href="/(auth)/sign-in" asChild>
            <Pressable style={styles.backLink}>
              <ArrowLeft color="#4F7D1A" size={17} />
              <Text style={styles.backLinkText}>Back to sign in</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: isDark ? '#10120F' : '#F7F5EF' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    padding: 26,
    borderWidth: 1,
    borderColor: isDark ? '#343A31' : '#E5E2D8',
    borderRadius: 28,
    backgroundColor: isDark ? '#1A1E18' : '#FFFEFB',
  },
  iconShell: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: isDark ? '#273321' : '#EAF3DE',
  },
  title: {
    marginTop: 20,
    color: isDark ? '#F4F5F1' : '#2C2C2A',
    fontFamily: 'Lato_700Bold',
    fontSize: 27,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 9,
    color: isDark ? '#A6ADA1' : '#737270',
    fontFamily: 'Lato_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  form: { width: '100%', gap: 10, marginTop: 26 },
  label: { color: isDark ? '#E5E8E1' : '#444441', fontFamily: 'Lato_700Bold', fontSize: 14 },
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
  button: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#4F7D1A',
  },
  buttonDisabled: { backgroundColor: '#AFC59A' },
  buttonPressed: { backgroundColor: '#3B6D11' },
  buttonText: { color: '#FFFFFF', fontFamily: 'Lato_700Bold', fontSize: 16 },
  errorText: {
    color: '#B42318',
    fontFamily: 'Lato_400Regular',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 24 },
  backLinkText: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 14 },
});
