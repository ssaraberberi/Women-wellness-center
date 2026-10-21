/* Small values kept on the device: the session token and the language.
   On a phone that is the Keychain / Keystore, through expo-secure-store.
   The web build (used to preview the app in a browser) has neither, so
   it falls back to localStorage there and nowhere else. */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const web = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  if (web) { try { return localStorage.getItem(key); } catch { return null; } }
  return SecureStore.getItemAsync(key).catch(() => null);
}
export async function setItem(key: string, value: string) {
  if (web) { try { localStorage.setItem(key, value); } catch {} return; }
  await SecureStore.setItemAsync(key, value);
}
export async function removeItem(key: string) {
  if (web) { try { localStorage.removeItem(key); } catch {} return; }
  await SecureStore.deleteItemAsync(key).catch(() => {});
}
