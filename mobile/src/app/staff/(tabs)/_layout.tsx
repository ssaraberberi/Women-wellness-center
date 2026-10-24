import { Tabs } from 'expo-router';
import { tabIcon, tabScreenOptions } from '@/components/tabs';
import { useAuth } from '@/lib/auth-store';
import { useT } from '@/lib/i18n';

/** Therapists see their appointments where instructors see participants. */
export default function StaffTabs() {
  const { t } = useT();
  const therapistOnly = useAuth((s) => !!s.me?.staff?.isTherapist && !s.me?.staff?.isInstructor);
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: t('tabToday'), tabBarIcon: tabIcon('sun') }} />
      <Tabs.Screen name="schedule" options={{ title: t('tabSchedule'), tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="participants" options={{ title: therapistOnly ? t('tabAppointments') : t('tabParticipants'), tabBarIcon: tabIcon('users') }} />
      <Tabs.Screen name="notifications" options={{ title: t('tabNotifications'), tabBarIcon: tabIcon('bell') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabProfile'), tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}