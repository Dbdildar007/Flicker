const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const config = {
  resolver: { assetExts: ['bin','txt','jpg','png','gif','webp','mp4','mov','ttf','otf'] },
};
module.exports = mergeConfig(getDefaultConfig(__dirname), config);
