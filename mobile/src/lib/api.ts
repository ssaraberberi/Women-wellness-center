/* ============================================================
   The one door to the studio's API
   ------------------------------------------------------------
   The same endpoints the website uses, at the same address. The phone
   has no cookie jar it can trust, so it says it is the app
   (x-dua-client: mobile), is handed its token at sign-in, keeps it in
   the device's secure storage, and presents it as a Bearer token.
   ============================================================ */
import Constants from 'expo-constants';
import { getItem, setItem, removeItem } from './store';
import { getLang } from './i18n';

export const API_URL: string = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  'https://dua-pilates.com'
).replace(/\/$/, '');

const TOKEN_KEY = 'dua-session';
let token: string | null = null;
let onSignedOut: (() => void) | null = null;

export async function loadToken() {
  token = await getItem(TOKEN_KEY);
  return token;
}
export async function saveToken(t: string | null) {
  token = t;
  if (t) await setItem(TOKEN_KEY, t);
  else await removeItem(TOKEN_KEY);
}
export const hasToken = () => !!token;
/* A 401 on anything but the sign-in calls means the session ended on the
   server — thirty days passed, or a password was reset at the desk. */
export const whenSignedOut = (fn: () => void) => { onSignedOut = fn; };

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code; }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-dua-client': 'mobile',
    'x-dua-lang': getLang()
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = 'Bearer ' + token;
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('No connection. Check the internet and try again.', 0, 'offline');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/') && token) {
      await saveToken(null);
      onSignedOut && onSignedOut();
    }
    throw new ApiError((data && data.error) || 'Something went wrong', res.status, data && data.code);
  }
  return data as T;
}

export const get = <T = any>(path: string) => api<T>('GET', path);
export const post = <T = any>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});
export const put = <T = any>(path: string, body?: unknown) => api<T>('PUT', path, body ?? {});
