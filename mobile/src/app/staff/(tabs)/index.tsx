import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AgendaItem, mergeAgenda, type Schedule, type StaffItem } from '@/components/AgendaItem';
import { Card, EmptyState, ErrorState, Gap, Row, Screen, Section, SkeletonList, Stat, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { longDate, whenShort } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { space } from '@/theme';

interface Today {
  date: string;
  today: Schedule;
  upcomingCount: number;
  upcoming: Schedule;
  clientsToday: number;
  changes: { id: string; title: string; body: string; createdAt: string }[];
}

export default function StaffToday() {
  const router = useRouter();
  const { t, lang } = useT();
  const first = useAuth((s) => s.me?.profile?.firstName ?? '');
  const q = useQuery({ queryKey: ['staff-today'], queryFn: () => api<Today>('GET', '/staff/today'), refetchInterval: 60_000 });
  const open = (i: StaffItem) =>
    i.kind === 'class' ? router.push({ pathname: '/staff/session/[id]', params: { id: i.id } }) : router.push({ pathname: '/staff/appointment/[id]', params: { id: i.id } });

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <View style={{ paddingTop: space.md }}>
        <Text variant="title">{t('hello', { name: first })}</Text>
        <Text variant="body">{q.data ? longDate(`${q.data.date}T12:00:00Z`, lang) : ''}</Text>
      </View>
      <Gap h={space.lg} />
      {q.isPending ? (
        <SkeletonList count={4} />
      ) : !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <Row gap={space.md}>
            <Stat label={t('todaysSessions')} value={mergeAgenda(q.data.today).filter((i) => i.status !== 'CANCELLED').length} />
            <Stat label={t('tabClients')} value={q.data.clientsToday} sub={t('upcomingWeek', { n: q.data.upcomingCount })} />
          </Row>
          {q.data.today.closures.length ? (
            <Card style={{ marginTop: space.md }}>
              <Text variant="heading">{t('closedDay')}</Text>
              <Text variant="small">{q.data.today.closures[0].reason}</Text>
            </Card>
          ) : null}
          <Section title={t('todaysSessions')}>
            {mergeAgenda(q.data.today).length ? (
              mergeAgenda(q.data.today).map((i) => <AgendaItem key={i.id} item={i} onPress={() => open(i)} />)
            ) : (
              <EmptyState icon="sun" title={t('nothingToday')} />
            )}
          </Section>
          {q.data.changes.length ? (
            <Section title={t('scheduleChanges')}>
              {q.data.changes.map((c) => (
                <Card key={c.id} style={{ marginBottom: space.sm }}>
                  <Text variant="bodyMedium">{c.title}</Text>
                  <Text variant="small">{c.body}</Text>
                  <Text variant="caption">{whenShort(c.createdAt, lang)}</Text>
                </Card>
              ))}
            </Section>
          ) : null}
          <Section title={t('upcoming')}>
            {mergeAgenda(q.data.upcoming)
              .slice(0, 8)
              .map((i) => (
                <View key={i.id}>
                  <Text variant="caption" style={{ marginBottom: 4 }}>{whenShort(i.startsAt, lang)}</Text>
                  <AgendaItem item={i} onPress={() => open(i)} />
                </View>
              ))}
          </Section>
        </>
      )}
    </Screen>
  );
}
