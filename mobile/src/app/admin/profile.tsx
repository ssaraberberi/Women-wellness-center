import { ProfileScreen } from '@/components/shared-screens';
import { useT } from '@/lib/i18n';

export default function AdminProfile() {
  const { t } = useT();
  return <ProfileScreen base="/admin" links={[{ icon: 'bell', label: t('notifications'), href: '/admin/notifications' }]} />;
}