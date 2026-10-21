import { Stack } from 'expo-router/stack';
import { RoleGate } from '@/components/RoleGate';
import { stackOptions } from '@/components/nav';
import { useT } from '@/lib/i18n';

export default function AdminLayout() {
  const { t } = useT();
  return (
    <RoleGate role="admin">
      <Stack screenOptions={stackOptions(t('Back'))}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="class/[id]" options={{ title: t('Class') }} />
        <Stack.Screen name="reservation/[id]" options={{ title: t('Reservation') }} />
        <Stack.Screen name="new-reservation" options={{ title: t('New reservation'), presentation: 'modal' }} />
        <Stack.Screen name="book-classes" options={{ title: t('Book classes'), presentation: 'modal' }} />
      </Stack>
    </RoleGate>
  );
}
