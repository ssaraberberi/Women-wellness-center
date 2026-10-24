import { Tabs } from 'expo-router';
import { tabIcon, tabScreenOptions } from '@/components/tabs';
import { useT } from '@/lib/i18n';

export default function AdminTabs() {
  const { t } = useT();
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: t('tabDashboard'), tabBarIcon: tabIcon('bar-chart-2') }} />
      <Tabs.Screen name="calendar" options={{ title: t('tabCalendar'), tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="clients" options={{ title: t('tabClients'), tabBarIcon: tabIcon('users') }} />
      <Tabs.Screen name="staff" options={{ title: t('tabStaff'), tabBarIcon: tabIcon('briefcase') }} />
      <Tabs.Screen name="more" options={{ title: t('tabMore'), tabBarIcon: tabIcon('menu') }} />
    </Tabs>
  );
}