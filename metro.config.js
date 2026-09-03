const { getDefaultConfig } = require('expo/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativewind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname, {
  annotateReactComponents: false,
  includeWebReplay: false,
  getDefaultConfig(projectRoot, options) {
    const defaultConfig = getDefaultConfig(projectRoot, options);
    defaultConfig.resolver.assetExts.push('bin');
    return withNativewind(defaultConfig, { inlineRem: 16 });
  },
});

module.exports = config;
