import { api, refreshSession } from './api';
import { markReady, useAuth, type Me } from './auth-store';
import { queryClient } from './query';
import { registerForPush, unregisterPush } from './push';

export async function loadMe() {
  const me = await api<Me>('GET', '/me');
  useAuth.getState().setMe(me);
  return me;
}

/** At launch: a stored refresh token becomes a session again, or we start signed out. */
export async function restoreSession() {
  try {
    const stored = await useAuth.getState().hydrate();
    if (stored && (await refreshSession())) {
      await loadMe();
      void registerForPush();
    }
  } catch {
    // Offline at launch with a stored session: keep the token, the next request retries.
  } finally {
    markReady();
  }
}

export async function completeSignIn(tokens: { accessToken: string; refreshToken: string }) {
  await useAuth.getState().setTokens(tokens.accessToken, tokens.refreshToken);
  await loadMe();
  void registerForPush();
}

export async function signOut() {
  const { refreshToken, signOutLocal } = useAuth.getState();
  await unregisterPush();
  if (refreshToken) {
    try {
      await api('POST', '/auth/logout', { body: { refreshToken }, auth: false });
    } catch {
      /* the local session goes either way */
    }
  }
  await signOutLocal();
  queryClient.clear();
}
