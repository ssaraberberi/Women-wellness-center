/* Each role's app is closed to the others. The server refuses them
   anyway; this only saves somebody a screen of errors. */
import { type ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { useSession, type Role } from '@/lib/session';
import { Loading } from './ui';

export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { ready, user } = useSession();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/sign-in" />;
  if (user.role !== role) return <Redirect href="/" />;
  return <>{children}</>;
}
