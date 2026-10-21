import { Tabs } from 'expo-router/js-tabs';
import { icon, tabOptions } from '@/components/nav';
import { useT } from '@/lib/i18n';

export default function AdminTabs() {
  const { t } = useT();
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="index" options={{ title: t('Schedule'), tabBarLabel: t('Schedule'), tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="reservations" options={{ title: t('Reservations'), tabBarLabel: t('Reservations'), tabBarIcon: icon('receipt-outline') }} />
      <Tabs.Screen name="studio" options={{ title: t('Studio'), tabBarLabel: t('Studio'), tabBarIcon: icon('stats-chart-outline') }} />
      <Tabs.Screen name="account" options={{ title: t('Account'), tabBarLabel: t('Account'), tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
