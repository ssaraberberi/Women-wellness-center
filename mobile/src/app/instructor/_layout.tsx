import { Stack } from 'expo-router/stack';
import { RoleGate } from '@/components/RoleGate';
import { stackOptions } from '@/components/nav';
import { useT } from '@/lib/i18n';

export default function InstructorLayout() {
  const { t } = useT();
  return (
    <RoleGate role="instructor">
      <Stack screenOptions={stackOptions(t('Back'))}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="class/[id]" options={{ title: t('Class') }} />
      </Stack>
    </RoleGate>
  );
}
