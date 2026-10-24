import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, EmptyState, ErrorState, Gap, Header, KeyValue, Notice, Row, Screen, Section, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { longDate, time } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { colors, space } from '@/theme';

interface Detail {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  capacity: number;
  booked: number;
  waitlist: number;
  canMarkAttendance: boolean;
  participants: { bookingId: string; name: string; firstClass: boolean; attendance: 'PRESENT' | 'ABSENT' | null; notes: string[] }[];
}

/** The roster: names, first-timers marked, one tap for present or absent. No payments, no admin notes. */
export default function StaffSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['staff-session', id], queryFn: () => api<Detail>('GET', `/staff/sessions/${id}`) });
  const mark = useMutation({
    mutationFn: ({ bookingId, status }: { bookingId: string; status: 'PRESENT' | 'ABSENT' }) => api('POST', `/staff/bookings/${bookingId}/attendance`, { body: { status } }),
    onMutate: async ({ bookingId, status }) => {
      // Instant feedback at the studio door; rolled back if the server refuses.
      const prev = qc.getQueryData<Detail>(['staff-session', id]);
      if (prev) qc.setQueryData(['staff-session', id], { ...prev, participants: prev.participants.map((p) => (p.bookingId === bookingId ? { ...p, attendance: status } : p)) });
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['staff-session', id], ctx.prev);
      Alert.alert('DUA', errorText(e, lang));
    },
  });
  const s = q.data;

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={s?.title ?? ''} back />
      {q.isPending ? (
        <SkeletonList count={5} />
      ) : !s ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <KeyValue icon="calendar" text={longDate(s.startsAt, lang)} />
          <KeyValue icon="clock" text={`${time(s.startsAt)} – ${time(s.endsAt)}`} />
          <KeyValue icon="users" text={`${s.booked}/${s.capacity}${s.waitlist ? ` · ${t('waitlist')} ${s.waitlist}` : ''}`} />
          {s.status === 'CANCELLED' ? <Notice tone="danger" text={t('CANCELLED')} /> : null}
          {!s.canMarkAttendance ? (
            <>
              <Gap h={space.sm} />
              <Notice text={t('attendanceOpens')} />
            </>
          ) : null}
          <Section title={`${t('participants')} (${s.participants.length})`}>
            {s.participants.length ? (
              s.participants.map((p) => (
                <Card key={p.bookingId} style={{ marginBottom: space.sm }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="heading">{p.name}</Text>
                      <Row style={{ marginTop: 4 }}>
                        {p.firstClass ? <Badge label={t('firstClass')} tone="wine" /> : null}
                        {p.attendance ? <Badge label={t(p.attendance)} tone={p.attendance === 'PRESENT' ? 'success' : 'danger'} /> : null}
                      </Row>
                      {p.notes.map((n, i) => (
                        <Text key={i} variant="small" style={{ color: colors.inkSoft, marginTop: 4 }}>• {n}</Text>
                      ))}
                    </View>
                  </Row>
                  {s.canMarkAttendance && s.status !== 'CANCELLED' ? (
                    <Row style={{ marginTop: space.md }}>
                      <Button small style={{ flex: 1 }} variant={p.attendance === 'PRESENT' ? 'primary' : 'secondary'} icon="check" title={t('markPresent')} onPress={() => mark.mutate({ bookingId: p.bookingId, status: 'PRESENT' })} />
                      <Button small style={{ flex: 1 }} variant={p.attendance === 'ABSENT' ? 'primary' : 'secondary'} icon="x" title={t('markAbsent')} onPress={() => mark.mutate({ bookingId: p.bookingId, status: 'ABSENT' })} />
                    </Row>
                  ) : null}
                </Card>
              ))
            ) : (
              <EmptyState icon="users" title={t('noBookings')} />
            )}
          </Section>
        </>
      )}
    </Screen>
  );
}
