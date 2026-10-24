import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { Fraunces_400Regular_Italic, Fraunces_500Medium } from '@expo-google-fonts/fraunces';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-store';
import { queryClient } from '@/lib/query';
import { restoreSession } from '@/lib/session';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

/**
 * One app, three experiences. Which one opens is decided by the role the API
 * gives the signed-in account — never by anything chosen in the app.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Fraunces_500Medium, Fraunces_400Regular_Italic, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold });
  const ready = useAuth((s) => s.ready);
  const role = useAuth((s) => s.me?.role ?? null);
  const router = useRouter();

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (ready && fontsLoaded) void SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);

  // Tapping a notification opens what it is about.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const d = r.notification.request.content.data as Record<string, string>;
      const r0 = useAuth.getState().me?.role;
      if (r0 === 'CLIENT' && d?.sessionId) router.push({ pathname: '/client/class/[id]', params: { id: d.sessionId } });
      else if (r0 === 'CLIENT' && d?.kind === 'spa') router.push('/client/classes');
      else if (r0 === 'STAFF' && d?.sessionId) router.push({ pathname: '/staff/session/[id]', params: { id: d.sessionId } });
      else if (r0) router.push(r0 === 'ADMIN' ? '/admin' : r0 === 'STAFF' ? '/staff/notifications' : '/client/notifications');
    });
    return () => sub.remove();
  }, [router]);

  if (!ready || !fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!role}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={role === 'CLIENT'} redirectTo="/">
          <Stack.Screen name="client" />
        </Stack.Protected>
        <Stack.Protected guard={role === 'STAFF'} redirectTo="/">
          <Stack.Screen name="staff" />
        </Stack.Protected>
        <Stack.Protected guard={role === 'ADMIN'} redirectTo="/">
          <Stack.Screen name="admin" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
