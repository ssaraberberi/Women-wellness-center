import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Card, ErrorState, Gap, IconButton, ListRow, Notice, Row, Screen, Section, Segmented, SkeletonList, Stat, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { lek, time } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, space } from '@/theme';

interface Dash {
  today: {
    sessions: { id: string; startsAt: string; title: string; instructor: string | null; booked: number; capacity: number; waitlist: number; status: string }[];
    spa: { id: string; startsAt: string; title: string; client: string; therapist: string; room: string; status: string }[];
    availablePlaces: number;
    staff: { id: string; name: string; classes: number; appointments: number; firstAt: string | null }[];
  };
  metrics: { bookings: number; activeMembers: number; newClients: number; membershipSales: number; revenue: number; cancellations: number; waitlists: number };
  attention: { pendingOrders: number; pendingRequests: number };
}

export default function AdminDashboard() {
  const router = useRouter();
  const { t } = useT();
  const first = useAuth((s) => s.me?.profile?.firstName ?? '');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const q = useQuery({ queryKey: ['admin-dash', period], queryFn: () => api<Dash>('GET', `/admin/dashboard?period=${period}`), refetchInterval: 60_000 });
  const unread = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ unread: number }>('GET', '/me/notifications?limit=1') });
  const d = q.data;

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="title">{t('hello', { name: first })}</Text>
          <Text variant="body">DUA Pilates & SPA</Text>
        </View>
        <IconButton name="bell" label={t('notifications')} badge={unread.data?.unread} onPress={() => router.push('/admin/notifications')} />
      </Row>
      <Gap h={space.md} />
      <Segmented options={[{ value: 'day', label: t('day') }, { value: 'week', label: t('week') }, { value: 'month', label: t('month') }]} value={period} onChange={setPeriod} />
      <Gap h={space.md} />
      {q.isPending ? (
        <SkeletonList count={4} height={90} />
      ) : !d ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          {d.attention.pendingOrders ? (
            <ListRow icon="credit-card" label={t('pendingPayments', { n: d.attention.pendingOrders })} onPress={() => router.push('/admin/orders')} />
          ) : null}
          {d.attention.pendingRequests ? (
            <ListRow icon="inbox" label={t('pendingRequests', { n: d.attention.pendingRequests })} onPress={() => router.push('/admin/requests')} />
          ) : null}
          <Gap h={space.md} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            <Stat label={t('revenue')} value={lek(d.metrics.revenue)} />
            <Stat label={t('bookings')} value={d.metrics.bookings} />
            <Stat label={t('activeMembers')} value={d.metrics.activeMembers} />
            <Stat label={t('newClients')} value={d.metrics.newClients} />
            <Stat label={t('membershipSales')} value={d.metrics.membershipSales} />
            <Stat label={t('cancellations')} value={d.metrics.cancellations} />
            <Stat label={t('waitlists')} value={d.metrics.waitlists} />
            <Stat label={t('freePlaces')} value={d.today.availablePlaces} />
          </View>

          <Section title={t('todayClasses')}>
            {d.today.sessions.length ? (
              d.today.sessions.map((s) => (
                <Card key={s.id} onPress={() => router.push({ pathname: '/admin/session/[id]', params: { id: s.id } })} style={{ marginBottom: space.sm }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="heading">{time(s.startsAt)} · {s.title}</Text>
                      <Text variant="small">{s.instructor ?? '—'}</Text>
                    </View>
                    {s.status === 'CANCELLED' ? <Badge label={t('CANCELLED')} tone="danger" /> : <Badge label={`${s.booked}/${s.capacity}${s.waitlist ? ` +${s.waitlist}` : ''}`} tone={s.booked >= s.capacity ? 'wine' : 'neutral'} />}
                  </Row>
                </Card>
              ))
            ) : (
              <Text variant="small">—</Text>
            )}
          </Section>
          <Section title={t('todaySpa')}>
            {d.today.spa.length ? (
              d.today.spa.map((a) => (
                <Card key={a.id} style={{ marginBottom: space.sm }}>
                  <Text variant="heading">{time(a.startsAt)} · {a.title}</Text>
                  <Text variant="small">{a.client} · {a.therapist} · {a.room}</Text>
                </Card>
              ))
            ) : (
              <Text variant="small">—</Text>
            )}
          </Section>
          <Section title={t('staffToday')}>
            {d.today.staff.length ? (
              d.today.staff.map((s) => (
                <Row key={s.id} style={{ paddingVertical: 6 }}>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>{s.name}</Text>
                  <Text variant="small">{s.firstAt ? `${time(s.firstAt)} · ` : ''}{s.classes + s.appointments}</Text>
                </Row>
              ))
            ) : (
              <Notice text={t('nothingToday')} />
            )}
          </Section>
          <Gap h={space.lg} />
          <Text variant="caption" style={{ color: colors.muted }} center>
            {t('analytics')} → {t('tabMore')}
          </Text>
        </>
      )}
    </Screen>
  );
}
