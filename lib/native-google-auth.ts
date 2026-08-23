export type NativeGoogleCredential = {
  idToken: string;
  nonce: string;
};

export async function getNativeGoogleCredential(): Promise<NativeGoogleCredential | null> {
  throw new Error('Native Google Sign-In is only available in the iOS and Android apps.');
}
