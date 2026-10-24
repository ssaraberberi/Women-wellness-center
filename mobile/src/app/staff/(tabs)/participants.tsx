import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AgendaItem, mergeAgenda, type Schedule, type StaffItem } from '@/components/AgendaItem';
import { EmptyState, ErrorState, Header, Screen, Section, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { addDays, tirane, todayISO, whenShort } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { space } from '@/theme';

/**
 * The sessions with people in them, from today on: tap one for its list.
 * For a therapist the same tab lists her appointments.
 */
export default function Participants() {
  const router = useRouter();
  const { t, lang } = useT();
  const therapistOnly = useAuth((s) => !!s.me?.staff?.isTherapist && !s.me?.staff?.isInstructor);
  const today = todayISO();
  const [now] = useState(() => Date.now());
  const q = useQuery({ queryKey: ['staff-schedule', 'next7', today], queryFn: () => api<Schedule>('GET', `/staff/schedule?from=${today}&to=${addDays(today, 7)}`) });
  const items = q.data ? mergeAgenda(q.data).filter((i) => i.status !== 'CANCELLED' && +new Date(i.endsAt) > now - 3 * 3600_000) : [];
  const open = (i: StaffItem) =>
    i.kind === 'class' ? router.push({ pathname: '/staff/session/[id]', params: { id: i.id } }) : router.push({ pathname: '/staff/appointment/[id]', params: { id: i.id } });
  const days = [...new Set(items.map((i) => tirane(i.startsAt).iso))];

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={therapistOnly ? t('tabAppointments') : t('participants')} />
      {q.isPending ? (
        <SkeletonList count={5} />
      ) : !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !items.length ? (
        <EmptyState icon="users" title={t('nothingToday')} />
      ) : (
        days.map((d) => (
          <Section key={d} title={whenShort(`${d}T10:00:00Z`, lang).split(' · ')[0]}>
            {items
              .filter((i) => tirane(i.startsAt).iso === d)
              .map((i) => (
                <AgendaItem key={i.id} item={i} onPress={() => open(i)} />
              ))}
          </Section>
        ))
      )}
      <Text variant="caption" style={{ marginTop: space.md }}>{t('attendanceOpens')}</Text>
    </Screen>
  );
}
