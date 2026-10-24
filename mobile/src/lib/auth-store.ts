import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type Role = 'CLIENT' | 'STAFF' | 'ADMIN';

export interface Me {
  id: string;
  email: string;
  role: Role;
  status: string;
  isOwner: boolean;
  createdAt: string;
  profile: { firstName: string; lastName: string; phone: string | null; language: 'sq' | 'en'; marketingConsent: boolean } | null;
  staff: { isInstructor: boolean; isTherapist: boolean; canViewClientNotes: boolean; bio: string | null } | null;
  notificationPrefs: { pushEnabled: boolean; emailEnabled: boolean; reminders: boolean; waitlist: boolean; marketing: boolean };
}

const REFRESH_KEY = 'dua.refreshToken';
const LANG_KEY = 'dua.lang';
// The profile is kept too, so an offline launch still opens the right app.
const ME_KEY = 'dua.me';

interface AuthState {
  /** false until the stored session has been read at launch */
  ready: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  me: Me | null;
  lang: 'sq' | 'en';
  setTokens: (access: string, refresh: string) => Promise<void>;
  setMe: (me: Me | null) => void;
  setLang: (lang: 'sq' | 'en') => void;
  signOutLocal: () => Promise<void>;
  hydrate: () => Promise<string | null>;
}

/**
 * The refresh token lives in the Keychain / Keystore (SecureStore); the
 * short-lived access token only in memory.
 */
export const useAuth = create<AuthState>((set) => ({
  ready: false,
  accessToken: null,
  refreshToken: null,
  me: null,
  lang: 'sq',
  setTokens: async (accessToken, refreshToken) => {
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },
  setMe: (me) => {
    set({ me });
    if (me) void SecureStore.setItemAsync(ME_KEY, JSON.stringify(me));
    if (me?.profile?.language) {
      set({ lang: me.profile.language });
      void SecureStore.setItemAsync(LANG_KEY, me.profile.language);
    }
  },
  setLang: (lang) => {
    set({ lang });
    void SecureStore.setItemAsync(LANG_KEY, lang);
  },
  signOutLocal: async () => {
    await Promise.all([SecureStore.deleteItemAsync(REFRESH_KEY), SecureStore.deleteItemAsync(ME_KEY)]);
    set({ accessToken: null, refreshToken: null, me: null });
  },
  hydrate: async () => {
    const [refreshToken, lang, meJson] = await Promise.all([SecureStore.getItemAsync(REFRESH_KEY), SecureStore.getItemAsync(LANG_KEY), SecureStore.getItemAsync(ME_KEY)]);
    let me: Me | null = null;
    try {
      me = refreshToken && meJson ? (JSON.parse(meJson) as Me) : null;
    } catch {
      me = null;
    }
    set({ refreshToken, me, lang: lang === 'en' ? 'en' : 'sq' });
    return refreshToken;
  },
}));

export const markReady = () => useAuth.setState({ ready: true });
