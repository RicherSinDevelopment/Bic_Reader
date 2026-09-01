const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const googlePlugin = iosClientId
  ? [
      'react-native-nitro-google-signin',
      {
        iosUrlScheme: `com.googleusercontent.apps.${iosClientId.replace(
          '.apps.googleusercontent.com',
          '',
        )}`,
      },
    ]
  : null;

// Expo supplies the normalized app.json contents as `config`. Extending that
// object keeps app.json authoritative while allowing the environment-specific
// Google URL scheme to be added for native builds.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: config.android?.package ?? 'com.bicreader.app',
  },
  plugins: [...(config.plugins ?? []), ...(googlePlugin ? [googlePlugin] : [])],
});
