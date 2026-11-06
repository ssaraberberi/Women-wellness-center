import * as SecureStore from 'expo-secure-store';

/** Phones: the Keychain / Keystore. The web build uses storage.web.ts instead. */
export const storage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
