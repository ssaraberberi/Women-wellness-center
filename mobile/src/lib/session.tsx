/* Who is signed in, for the whole app. The role decides which of the
   three apps she sees — the client's, the instructor's or the studio's —
   and the server decides the role, never the phone. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { get, post, loadToken, saveToken, whenSignedOut } from './api';
import { registerForPush, forgetPush, clearReminders } from './push';

export type Role = 'admin' | 'instructor' | 'client';
export type User = { id: string; role: Role; name: string; email: string | null; phone: string | null; emailVerified?: boolean };

type Ctx = {
  ready: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (body: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};
const SessionContext = createContext<Ctx>(null as unknown as Ctx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    whenSignedOut(() => setUser(null));
    (async () => {
      try {
        if (await loadToken()) {
          const me = await get<{ user: User | null }>('/api/me');
          if (me.user) { setUser(me.user); registerForPush(); }
          else await saveToken(null);
        }
      } catch {
        /* Offline at launch: keep the token and show the sign-in screen
           only if there was none. The next request will tell. */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const signedIn = useCallback(async (r: { user: User; token: string }) => {
    await saveToken(r.token);
    setUser(r.user);
    registerForPush();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signedIn(await post('/api/auth/login', { email: email.trim(), password }));
  }, [signedIn]);

  const register = useCallback(async (body: { name: string; email: string; phone: string; password: string }) => {
    await signedIn(await post('/api/auth/register', body));
  }, [signedIn]);

  const signOut = useCallback(async () => {
    await forgetPush();
    await clearReminders();
    await post('/api/auth/logout').catch(() => {});
    await saveToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ ready, user, signIn, register, signOut }), [ready, user, signIn, register, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
