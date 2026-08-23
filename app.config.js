const appJson = require('./app.json');

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

module.exports = {
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    package: appJson.expo.android.package ?? 'com.bicreader.app',
  },
  plugins: [...appJson.expo.plugins, ...(googlePlugin ? [googlePlugin] : [])],
};
