// OAuth client IDs are public identifiers. Keep the production iOS ID as a
// fallback so clean EAS prebuilds do not silently omit the Google Sign-In
// plugin when `.env.local` is unavailable on the build worker.
const defaultIosClientId =
  '545678162563-g53ml0v4bnbrj85p3tg48q541lnraau5.apps.googleusercontent.com';
const iosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || defaultIosClientId;
const googlePlugin = [
  'react-native-nitro-google-signin',
  {
    iosUrlScheme: `com.googleusercontent.apps.${iosClientId.replace(
      '.apps.googleusercontent.com',
      '',
    )}`,
  },
];

// Expo supplies the normalized app.json contents as `config`. Extending that
// object keeps app.json authoritative while allowing the environment-specific
// Google URL scheme to be added for native builds.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: config.android?.package ?? 'com.bicreader.app',
  },
  plugins: [...(config.plugins ?? []), googlePlugin],
});
