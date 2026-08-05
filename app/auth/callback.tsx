import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { CheckCircle2, CircleAlert } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createSessionFromAuthUrl } from '@/lib/auth-deep-link';

type CallbackStatus = 'loading' | 'success' | 'error';

export default function AuthCallback() {
  const incomingUrl = Linking.useLinkingURL();
  const router = useRouter();
  const handledUrl = useRef<string | null>(null);
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [message, setMessage] = useState('Confirming your email…');

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
        router.replace('/HomePage');
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Unable to confirm your email.');
      });
  }, [incomingUrl, router]);

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
            onPress={() => router.replace('/(auth)/sign-in')}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F5EF',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    padding: 28,
    borderWidth: 1,
    borderColor: '#E5E2D8',
    borderRadius: 28,
    backgroundColor: '#FFFEFB',
  },
  iconShell: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: '#EAF3DE',
  },
  errorIconShell: { backgroundColor: '#FEECEB' },
  title: {
    marginTop: 22,
    color: '#2C2C2A',
    fontFamily: 'Lato_700Bold',
    fontSize: 25,
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    color: '#737270',
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
