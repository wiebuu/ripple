// Metro config: also watch the repo-level /shared folder (domain model shared with the API).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../../shared')];

module.exports = config;
