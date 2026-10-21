import { Tabs } from 'expo-router/js-tabs';
import { icon, tabOptions } from '@/components/nav';
import { useT } from '@/lib/i18n';

export default function InstructorTabs() {
  const { t } = useT();
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="index" options={{ title: t('My classes'), tabBarLabel: t('Classes'), tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="availability" options={{ title: t('My hours'), tabBarLabel: t('Hours'), tabBarIcon: icon('time-outline') }} />
      <Tabs.Screen name="account" options={{ title: t('Account'), tabBarLabel: t('Account'), tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
