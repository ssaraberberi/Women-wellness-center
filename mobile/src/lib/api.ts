import { useAuth } from './auth-store';

/**
 * The phone talks to the API at EXPO_PUBLIC_API_URL — the Railway URL, or
 * this computer's LAN address while developing. Never "localhost": on a
 * phone that is the phone itself.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time: ten requests that all got 401 share one rotation. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const { refreshToken, setTokens, signOutLocal } = useAuth.getState();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.status === 401) {
        await signOutLocal();
        return false;
      }
      if (!res.ok) return false;
      const json = await res.json();
      await setTokens(json.accessToken, json.refreshToken);
      return true;
    } catch {
      return false; // offline: keep the stored session, try again later
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

type Opts = { body?: unknown; idempotencyKey?: string; auth?: boolean; timeoutMs?: number };

export async function api<T = any>(method: string, path: string, opts: Opts = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'NO_API_URL', 'EXPO_PUBLIC_API_URL is not set');
  const doFetch = async () => {
    const { accessToken, lang } = useAuth.getState();
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': lang };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
    try {
      return await fetch(API_URL + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: ctrl.signal });
    } catch (e) {
      throw new ApiError(0, (e as Error).name === 'AbortError' ? 'TIMEOUT' : 'NETWORK', 'No connection to DUA');
    } finally {
      clearTimeout(timer);
    }
  };

  if (opts.auth !== false && !useAuth.getState().accessToken && useAuth.getState().refreshToken) await refreshSession();
  let res = await doFetch();
  if (res.status === 401 && opts.auth !== false && (await refreshSession())) res = await doFetch();

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(res.status, err.code ?? `HTTP_${res.status}`, err.message ?? 'Request failed', err.details);
  }
  return json as T;
}

/** A key per user action: a retried tap or a flaky network books once. */
export const newIdempotencyKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
