import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth-store';

/** The door: each role to its own app, everyone else to the welcome screen. */
export default function Index() {
  const role = useAuth((s) => s.me?.role);
  if (role === 'ADMIN') return <Redirect href="/admin" />;
  if (role === 'STAFF') return <Redirect href="/staff" />;
  if (role === 'CLIENT') return <Redirect href="/client" />;
  return <Redirect href="/welcome" />;
}
