import { Stack } from 'expo-router';
import { colors } from '@/theme';

export const unstable_settings = { anchor: '(tabs)' };

export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}