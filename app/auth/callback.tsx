import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { CheckCircle2, CircleAlert } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createSessionFromAuthUrl } from '@/lib/auth-deep-link';
import {
  authReturnTarget,
  authRoute,
  destinationAfterAuth,
} from '@/lib/authNavigation';

type CallbackStatus = 'loading' | 'success' | 'error';

export default function AuthCallback() {
  const incomingUrl = Linking.useLinkingURL();
  const router = useRouter();
  const handledUrl = useRef<string | null>(null);
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [message, setMessage] = useState('Confirming your email…');
  const isDark = useColorScheme() === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const returnTo = authReturnTarget(
    incomingUrl
      ? Linking.parse(incomingUrl).queryParams?.returnTo as string | undefined
      : undefined,
  );

  useEffect(() => {
    if (!incomingUrl || handledUrl.current === incomingUrl) return;

    handledUrl.current = incomingUrl;

    void createSessionFromAuthUrl(incomingUrl)
      .then((session) => {
        if (!session) {
          throw new Error('Your email was confirmed, but no session was created. Please sign in.');
        }

        setStatus('success');
        setMessage('Your email is confirmed. Taking you to your library…');
        router.replace(destinationAfterAuth(returnTo));
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Unable to confirm your email.');
      });
  }, [incomingUrl, returnTo, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <View style={[styles.iconShell, status === 'error' && styles.errorIconShell]}>
          {status === 'loading' ? (
            <ActivityIndicator color="#4F7D1A" size="large" />
          ) : status === 'success' ? (
            <CheckCircle2 color="#4F7D1A" size={38} strokeWidth={1.8} />
          ) : (
            <CircleAlert color="#B42318" size={38} strokeWidth={1.8} />
          )}
        </View>

        <Text style={styles.title}>
          {status === 'error' ? 'Confirmation problem' : 'Confirming your account'}
        </Text>
        <Text style={styles.message}>{message}</Text>

        {status === 'error' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(authRoute('/(auth)/sign-in', returnTo))}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: isDark ? '#10120F' : '#F7F5EF',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    padding: 28,
    borderWidth: 1,
    borderColor: isDark ? '#343A31' : '#E5E2D8',
    borderRadius: 28,
    backgroundColor: isDark ? '#1A1E18' : '#FFFEFB',
  },
  iconShell: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: isDark ? '#273321' : '#EAF3DE',
  },
  errorIconShell: { backgroundColor: isDark ? '#321E1C' : '#FEECEB' },
  title: {
    marginTop: 22,
    color: isDark ? '#F4F5F1' : '#2C2C2A',
    fontFamily: 'Lato_700Bold',
    fontSize: 25,
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    color: isDark ? '#A6ADA1' : '#737270',
    fontFamily: 'Lato_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: '#4F7D1A',
  },
  buttonPressed: { backgroundColor: '#3B6D11' },
  buttonText: { color: '#FFFFFF', fontFamily: 'Lato_700Bold', fontSize: 16 },
});
