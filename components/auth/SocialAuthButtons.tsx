import { FontAwesome } from '@expo/vector-icons';
import type { Provider } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { createSessionFromAuthUrl } from '@/lib/auth-deep-link';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type SocialProvider = Extract<Provider, 'apple' | 'google'>;

type SocialAuthButtonsProps = {
  disabled?: boolean;
  onError: (message: string | null) => void;
};

const providers: { icon: 'apple' | 'google'; label: string; provider: SocialProvider }[] = [
  { icon: 'google', label: 'Continue with Google', provider: 'google' },
  { icon: 'apple', label: 'Continue with Apple', provider: 'apple' },
];

export function SocialAuthButtons({ disabled = false, onError }: SocialAuthButtonsProps) {
  const [activeProvider, setActiveProvider] = useState<SocialProvider | null>(null);
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const handleNativeAppleAuth = async () => {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    const credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) throw error;
    if (!data.session) throw new Error('Apple sign-in completed, but no session was created.');

    if (credential.fullName) {
      const fullName = AppleAuthentication.formatFullName(credential.fullName).trim();
      if (fullName) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            given_name: credential.fullName.givenName,
            family_name: credential.fullName.familyName,
          },
        });
        if (updateError) throw updateError;
      }
    }

    router.replace('/HomePage');
  };

  const handleSocialAuth = async (provider: SocialProvider) => {
    onError(null);
    setActiveProvider(provider);

    try {
      if (provider === 'apple' && Platform.OS === 'ios') {
        await handleNativeAppleAuth();
        return;
      }

      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
      });

      if (error) throw error;
      if (Platform.OS === 'web') return;
      if (!data.url) throw new Error('The sign-in provider did not return an authorization URL.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        const session = await createSessionFromAuthUrl(result.url);
        if (!session) throw new Error('Sign-in completed, but no session was created.');
        router.replace('/HomePage');
      }
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }
      onError(error instanceof Error ? error.message : 'Unable to continue with this provider.');
    } finally {
      setActiveProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.buttons}>
        {providers.map(({ icon, label, provider }) => {
          const isLoading = activeProvider === provider;
          const isDisabled = disabled || activeProvider !== null;

          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="button"
              disabled={isDisabled}
              key={provider}
              onPress={() => void handleSocialAuth(provider)}
              style={({ pressed }) => [
                styles.button,
                isDisabled && styles.buttonDisabled,
                pressed && !isDisabled && styles.buttonPressed,
              ]}
            >
              <FontAwesome color={isDark ? '#F4F5F1' : '#2C2C2A'} name={icon} size={20} />
              <Text style={styles.buttonText}>{isLoading ? 'Connecting…' : label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  container: { gap: 14, marginTop: 22 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: isDark ? '#343A31' : '#E5E2D8' },
  dividerText: { color: isDark ? '#9EA69A' : '#888780', fontFamily: 'Lato_400Regular', fontSize: 12 },
  buttons: { gap: 10 },
  button: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: isDark ? '#42483F' : '#D3D1C7',
    borderRadius: 16,
    backgroundColor: isDark ? '#222720' : '#FFFFFF',
  },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { backgroundColor: isDark ? '#2A3027' : '#F4F3EE', transform: [{ scale: 0.99 }] },
  buttonText: { color: isDark ? '#F4F5F1' : '#2C2C2A', fontFamily: 'Lato_700Bold', fontSize: 15 },
});
