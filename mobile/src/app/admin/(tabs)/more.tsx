import { useRouter, type Href } from 'expo-router';
import { Gap, Header, ListRow, Screen } from '@/components/ui';
import type { IconName } from '@/components/ui';
import { useT, type TKey } from '@/lib/i18n';
import { signOut } from '@/lib/session';
import { space } from '@/theme';

const LINKS: { icon: IconName; key: TKey; href: Href }[] = [
  { icon: 'credit-card', key: 'orders', href: '/admin/orders' },
  { icon: 'dollar-sign', key: 'payments', href: '/admin/payments' },
  { icon: 'package', key: 'products', href: '/admin/products' },
  { icon: 'tag', key: 'promotions', href: '/admin/promotions' },
  { icon: 'trending-up', key: 'analytics', href: '/admin/analytics' },
  { icon: 'grid', key: 'timetable', href: '/admin/timetable' },
  { icon: 'feather', key: 'spaManagement', href: '/admin/spa-manage' },
  { icon: 'inbox', key: 'requests', href: '/admin/requests' },
  { icon: 'x-octagon', key: 'closures', href: '/admin/closures' },
  { icon: 'volume-2', key: 'announcements', href: '/admin/announcements' },
  { icon: 'briefcase', key: 'payroll', href: '/admin/payroll' },
  { icon: 'settings', key: 'settings', href: '/admin/settings' },
  { icon: 'shield', key: 'auditLog', href: '/admin/audit' },
];

export default function AdminMore() {
  const router = useRouter();
  const { t } = useT();
  return (
    <Screen>
      <Header title={t('tabMore')} />
      {LINKS.map((l) => (
        <ListRow key={l.key} icon={l.icon} label={t(l.key)} onPress={() => router.push(l.href)} />
      ))}
      <Gap h={space.lg} />
      <ListRow icon="user" label={t('profile')} onPress={() => router.push('/admin/profile')} />
      <ListRow icon="log-out" label={t('signOut')} danger onPress={() => void signOut()} />
    </Screen>
  );
}
