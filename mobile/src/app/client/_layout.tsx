import { Stack } from 'expo-router/stack';
import { RoleGate } from '@/components/RoleGate';
import { stackOptions } from '@/components/nav';
import { useT } from '@/lib/i18n';

export default function ClientLayout() {
  const { t } = useT();
  return (
    <RoleGate role="client">
      <Stack screenOptions={stackOptions(t('Back'))}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="reserve" options={{ title: t('Reserve') }} />
        <Stack.Screen name="reservation/[ref]" options={{ title: t('Reservation') }} />
      </Stack>
    </RoleGate>
  );
}
