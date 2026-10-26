import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { colors } from '@/theme';

/** The public pages on the website. No sign-in needed, so they open the same before and after login. */
export const LEGAL_URLS = {
  privacy: 'https://dua-pilates.com/privacy-policy',
  deleteAccount: 'https://dua-pilates.com/delete-account',
} as const;

/** In-app browser in the app's language; the system browser if that cannot open. */
export async function openLegal(page: keyof typeof LEGAL_URLS, lang: 'sq' | 'en') {
  const url = `${LEGAL_URLS[page]}?lang=${lang}`;
  try {
    await WebBrowser.openBrowserAsync(url, { controlsColor: colors.wine, toolbarColor: colors.bg });
  } catch {
    await Linking.openURL(url);
  }
}
