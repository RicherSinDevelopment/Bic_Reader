import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import {
  Image,
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

const logo = require('../../assets/images/Bicreaderlogo-large.png');

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();

  const canSubmit =
    name.trim().length > 0 && email.trim().length > 0 && password.length >= 8 && !isSubmitting;

  const handleSignUp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: Linking.createURL('auth/callback'),
        data: { full_name: name.trim() },
      },
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      router.replace('/HomePage');
      return;
    }

    setSuccessMessage('Account created. Check your email to confirm your address, then sign in.');
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
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Build your library and keep your reading journey in one place.
            </Text>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full name</Text>
                <View style={styles.inputShell}>
                  <UserRound color="#737270" size={20} strokeWidth={1.8} />
                  <TextInput
                    autoCapitalize="words"
                    autoComplete="name"
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor="#9E9C93"
                    returnKeyType="next"
                    style={styles.input}
                    value={name}
                  />
                </View>
              </View>

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
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputShell}>
                  <LockKeyhole color="#737270" size={20} strokeWidth={1.8} />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={setPassword}
                    placeholder="At least 8 characters"
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
                <Text style={styles.helperText}>Use 8 or more characters.</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                onPress={() => void handleSignUp()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  !canSubmit && styles.primaryButtonDisabled,
                  pressed && canSubmit && styles.primaryButtonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Creating account…' : 'Create account'}
                </Text>
              </Pressable>
              {errorMessage ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {errorMessage}
                </Text>
              ) : null}
              {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Already have an account?</Text>
              <Link href="/(auth)/sign-in" asChild>
                <Pressable hitSlop={8}>
                  <Text style={styles.switchLink}>Sign in</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F7F5EF' },
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
    left: -110,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#EAF3DE',
  },
  header: { alignItems: 'center', marginBottom: 20 },
  logo: { width: 64, height: 64, borderRadius: 18 },
  brand: {
    marginTop: 7,
    color: '#2E5A0D',
    fontFamily: 'Lato_700Bold',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E2D8',
    borderRadius: 28,
    backgroundColor: '#FFFEFB',
    shadowColor: '#173404',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  title: {
    color: '#2C2C2A',
    fontFamily: 'Lato_700Bold',
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 8,
    color: '#737270',
    fontFamily: 'Lato_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  form: { gap: 16, marginTop: 24 },
  fieldGroup: { gap: 8 },
  label: { color: '#444441', fontFamily: 'Lato_700Bold', fontSize: 14 },
  inputShell: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  helperText: { color: '#888780', fontFamily: 'Lato_400Regular', fontSize: 12 },
  primaryButton: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
  successText: {
    color: '#2E5A0D',
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
    marginTop: 24,
  },
  switchText: { color: '#737270', fontFamily: 'Lato_400Regular', fontSize: 14 },
  switchLink: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 14 },
});
