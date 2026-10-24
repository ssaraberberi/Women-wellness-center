import { Tabs } from 'expo-router';
import { tabIcon, tabScreenOptions } from '@/components/tabs';
import { useT } from '@/lib/i18n';

export default function ClientTabs() {
  const { t } = useT();
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: t('tabHome'), tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="book" options={{ title: t('tabBook'), tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="classes" options={{ title: t('tabMyClasses'), tabBarIcon: tabIcon('bookmark') }} />
      <Tabs.Screen name="packages" options={{ title: t('tabPackages'), tabBarIcon: tabIcon('package') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabProfile'), tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
