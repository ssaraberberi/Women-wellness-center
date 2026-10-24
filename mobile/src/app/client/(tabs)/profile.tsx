import { ProfileScreen } from '@/components/shared-screens';
import { useT } from '@/lib/i18n';

export default function ClientProfile() {
  const { t } = useT();
  return (
    <ProfileScreen
      base="/client"
      links={[
        { icon: 'credit-card', label: t('myMemberships'), href: '/client/memberships' },
        { icon: 'clock', label: t('bookingHistory'), href: '/client/classes' },
      ]}
    />
  );
}