/* The phone app reads the studio's rules from the same file the website
   and the server do — ../shared — so a booking the phone predicts is the
   booking the server decides. Metro only bundles what it watches, so that
   folder is added to what it watches. */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '..', 'shared')];
module.exports = config;
