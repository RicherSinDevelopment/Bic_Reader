import * as Crypto from 'expo-crypto';
import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isSuccessResponse,
} from 'react-native-nitro-google-signin';

export type NativeGoogleCredential = {
  idToken: string;
  nonce: string;
};

export async function getNativeGoogleCredential(): Promise<NativeGoogleCredential | null> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

  if (!webClientId) {
    throw new Error(
      'Google Sign-In is not configured. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and rebuild the app.',
    );
  }

  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce,
  );

  GoogleOneTapSignIn.configure({
    webClientId,
    iosClientId: iosClientId || undefined,
    offlineAccess: false,
    autoSelectOnSignIn: false,
    nonce: hashedNonce,
  });

  await GoogleOneTapSignIn.checkPlayServices();
  const response = await GoogleOneTapSignIn.presentExplicitSignIn();

  if (isCancelledResponse(response)) return null;
  if (!isSuccessResponse(response)) {
    throw new Error('Google did not return a sign-in credential. Please try again.');
  }

  if (!response.data.idToken) {
    throw new Error('Google did not return an identity token. Please try again.');
  }

  return { idToken: response.data.idToken, nonce };
}
