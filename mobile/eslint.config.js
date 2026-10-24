// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // TypeScript already resolves every namespace member; this rule cannot see
    // through the `export *` barrels of expo-calendar / expo-notifications.
    rules: { 'import/namespace': 'off' },
  },
]);
