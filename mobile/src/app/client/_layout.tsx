import { Stack } from 'expo-router';
import { colors } from '@/theme';

export const unstable_settings = { anchor: '(tabs)' };

export default function ClientLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
