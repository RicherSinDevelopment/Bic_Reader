import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { CircleAlert, Eye, EyeOff, LockKeyhole } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createSessionFromAuthUrl } from '@/lib/auth-deep-link';
import { supabase } from '@/lib/supabase';

type RecoveryStatus = 'loading' | 'ready' | 'error';

export default function ResetPassword() {
  const incomingUrl = Linking.useLinkingURL();
  const router = useRouter();
  const handledUrl = useRef<string | null>(null);
  const [status, setStatus] = useState<RecoveryStatus>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!incomingUrl || handledUrl.current === incomingUrl) return;

    handledUrl.current = incomingUrl;

    void createSessionFromAuthUrl(incomingUrl)
      .then((session) => {
        if (!session) throw new Error('The reset link did not create a recovery session.');
        setStatus('ready');
      })
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'The reset link is invalid.');
      });
  }, [incomingUrl]);

  const passwordsMatch = password === confirmPassword;
  const canSubmit = password.length >= 8 && passwordsMatch && !isSubmitting;

  const handlePasswordUpdate = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.replace('/HomePage');
  };

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#4F7D1A" size="large" />
        <Text style={styles.loadingText}>Opening your secure reset link…</Text>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <CircleAlert color="#B42318" size={42} strokeWidth={1.8} />
        <Text style={styles.title}>Reset link unavailable</Text>
        <Text style={styles.subtitle}>{errorMessage}</Text>
        <Pressable
          onPress={() => router.replace('/(auth)/forgot-password')}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Request another link</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.card}>
          <View style={styles.iconShell}>
            <LockKeyhole color="#4F7D1A" size={30} strokeWidth={1.8} />
          </View>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.subtitle}>Use at least 8 characters that you haven’t used before.</Text>

          <View style={styles.form}>
            <Text style={styles.label}>New password</Text>
            <View style={styles.inputShell}>
              <LockKeyhole color="#737270" size={20} strokeWidth={1.8} />
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor="#9E9C93"
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

            <Text style={[styles.label, styles.confirmLabel]}>Confirm new password</Text>
            <View style={styles.inputShell}>
              <LockKeyhole color="#737270" size={20} strokeWidth={1.8} />
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setConfirmPassword}
                onSubmitEditing={() => canSubmit && void handlePasswordUpdate()}
                placeholder="Enter it again"
                placeholderTextColor="#9E9C93"
                returnKeyType="done"
                secureTextEntry={!showPassword}
                style={styles.input}
                value={confirmPassword}
              />
            </View>

            {confirmPassword.length > 0 && !passwordsMatch ? (
              <Text style={styles.errorText}>Passwords do not match.</Text>
            ) : null}
            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={() => void handlePasswordUpdate()}
              style={({ pressed }) => [
                styles.button,
                !canSubmit && styles.buttonDisabled,
                pressed && canSubmit && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? 'Updating password…' : 'Update password'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F5EF' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
    backgroundColor: '#F7F5EF',
  },
  loadingText: {
    marginTop: 16,
    color: '#737270',
    fontFamily: 'Lato_400Regular',
    fontSize: 15,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    padding: 26,
    borderWidth: 1,
    borderColor: '#E5E2D8',
    borderRadius: 28,
    backgroundColor: '#FFFEFB',
  },
  iconShell: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: '#EAF3DE',
  },
  title: {
    marginTop: 20,
    color: '#2C2C2A',
    fontFamily: 'Lato_700Bold',
    fontSize: 27,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 9,
    color: '#737270',
    fontFamily: 'Lato_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  form: { width: '100%', marginTop: 24 },
  label: { color: '#444441', fontFamily: 'Lato_700Bold', fontSize: 14 },
  confirmLabel: { marginTop: 16 },
  inputShell: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D3D1C7',
    borderRadius: 16,
    backgroundColor: '#FAFAF8',
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#2C2C2A',
    fontFamily: 'Lato_400Regular',
    fontSize: 16,
  },
  errorText: {
    marginTop: 9,
    color: '#B42318',
    fontFamily: 'Lato_400Regular',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: '#4F7D1A',
  },
  buttonDisabled: { backgroundColor: '#AFC59A' },
  buttonPressed: { backgroundColor: '#3B6D11' },
  buttonText: { color: '#FFFFFF', fontFamily: 'Lato_700Bold', fontSize: 16 },
});
