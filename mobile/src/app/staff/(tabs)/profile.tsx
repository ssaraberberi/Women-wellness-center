import { ProfileScreen } from '@/components/shared-screens';
import { useT } from '@/lib/i18n';

export default function StaffProfile() {
  const { t } = useT();
  return (
    <ProfileScreen
      base="/staff"
      links={[
        { icon: 'clock', label: t('myHours'), href: '/staff/hours' },
        { icon: 'inbox', label: t('requests'), href: '/staff/requests' },
      ]}
    />
  );
}