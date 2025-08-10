// Learn more https://docs.expo.dev/guides/metro-config/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  tslib: require.resolve('tslib'),
};

module.exports = config;


