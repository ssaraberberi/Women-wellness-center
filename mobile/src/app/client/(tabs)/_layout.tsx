import { Tabs } from 'expo-router/js-tabs';
import { icon, tabOptions } from '@/components/nav';
import { useT } from '@/lib/i18n';

export default function ClientTabs() {
  const { t } = useT();
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="index" options={{ title: 'DUA', tabBarLabel: t('Home'), tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="book" options={{ title: t('Book a class'), tabBarLabel: t('Classes'), tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="packages" options={{ title: t('Packages'), tabBarLabel: t('Packages'), tabBarIcon: icon('pricetags-outline') }} />
      <Tabs.Screen name="account" options={{ title: t('Account'), tabBarLabel: t('Account'), tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
