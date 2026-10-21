/* The door: each role is sent to its own app. */
import { Redirect } from 'expo-router';
import { useSession } from '@/lib/session';
import { Loading } from '@/components/ui';

export default function Index() {
  const { ready, user } = useSession();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/sign-in" />;
  if (user.role === 'admin') return <Redirect href="/admin" />;
  if (user.role === 'instructor') return <Redirect href="/instructor" />;
  return <Redirect href="/client" />;
}
