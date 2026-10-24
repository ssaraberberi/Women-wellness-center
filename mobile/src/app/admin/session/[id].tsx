import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { ClientPicker } from '@/components/ClientPicker';
import { Badge, Button, Card, Chip, ErrorState, Field, Gap, Header, KeyValue, Row, Screen, Section, SkeletonList, Text } from '@/components/ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { longDate, time } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import type { SessionDto } from '@/lib/types';
import { space } from '@/theme';

interface AdminSession extends SessionDto {
  cancelReason: string | null;
  bookings: { id: string; userId: string; name: string; phone: string | null; status: string; source: string; creditsUsed: number; creditRefunded: boolean; attendance: string | null }[];
  waitlist: { id: string; position: number; name: string; status: string; offerExpiresAt: string | null }[];
}

/** One class at the desk: who is in it, who is waiting, and every change the studio can make. */
export default function AdminSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [startTime, setStartTime] = useState('');
  const [instructorId, setInstructorId] = useState<string | null | undefined>(undefined);
  const q = useQuery({ queryKey: ['admin-session', id], queryFn: () => api<AdminSession>('GET', `/admin/sessions/${id}`) });
  const instructors = useQuery({ queryKey: ['instructors'], queryFn: () => api<{ id: string; name: string }[]>('GET', '/instructors'), enabled: editing });
  const s = q.data;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-session', id] });
    void qc.invalidateQueries({ queryKey: ['admin-sessions'] });
    void qc.invalidateQueries({ queryKey: ['admin-dash'] });
  };
  const run = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: refresh,
    onError: (e) => {
      Alert.alert('DUA', errorText(e, lang));
      refresh();
    },
  });

  const bookingMenu = (b: AdminSession['bookings'][number]) =>
    Alert.alert(b.name, b.phone ?? '', [
      { text: t('close'), style: 'cancel' },
      ...(b.status === 'BOOKED'
        ? [
            { text: t('markPresent'), onPress: () => run.mutate(() => api('POST', `/admin/bookings/${b.id}/attendance`, { body: { status: 'PRESENT' } })) },
            { text: t('markAbsent'), onPress: () => run.mutate(() => api('POST', `/admin/bookings/${b.id}/attendance`, { body: { status: 'ABSENT' } })) },
            { text: `${t('cancelBooking')} + ${t('restoreCredit')}`, onPress: () => run.mutate(() => api('POST', `/admin/bookings/${b.id}/cancel`, { body: { restoreCredit: true } })) },
            { text: t('cancelBooking'), style: 'destructive' as const, onPress: () => run.mutate(() => api('POST', `/admin/bookings/${b.id}/cancel`, { body: { restoreCredit: false } })) },
          ]
        : []),
      ...((b.status === 'LATE_CANCELLED' || b.attendance === 'ABSENT') && !b.creditRefunded && b.creditsUsed > 0
        ? [{ text: t('restoreCredit'), onPress: () => run.mutate(() => api('POST', `/admin/bookings/${b.id}/restore-credit`, { body: { reason: 'Desk' } })) }]
        : []),
    ]);

  const saveEdit = () =>
    run.mutate(async () => {
      await api('PATCH', `/admin/sessions/${id}`, {
        body: {
          ...(capacity ? { capacity: Number(capacity) } : {}),
          ...(/^\d\d:\d\d$/.test(startTime) ? { startTime } : {}),
          ...(instructorId !== undefined ? { instructorId } : {}),
        },
      });
      setEditing(false);
    });

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={s?.classType.name ?? ''} back />
      {q.isPending ? (
        <SkeletonList count={5} />
      ) : !s ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <KeyValue icon="calendar" text={longDate(s.startsAt, lang)} />
          <KeyValue icon="clock" text={`${time(s.startsAt)} – ${time(s.endsAt)}`} />
          <KeyValue icon="user" text={s.instructor?.name ?? '—'} />
          <KeyValue icon="users" text={`${s.booked}/${s.capacity} · ${t('available')} ${s.available}`} />
          {s.status === 'CANCELLED' ? <Badge label={`${t('CANCELLED')}${s.cancelReason ? ` · ${s.cancelReason}` : ''}`} tone="danger" /> : null}

          {s.status === 'SCHEDULED' ? (
            <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
              <Button small variant="secondary" icon="user-plus" title={t('addParticipant')} onPress={() => setAdding((v) => !v)} />
              <Button small variant="secondary" icon="edit-2" title={t('edit')} onPress={() => setEditing((v) => !v)} />
              <Button
                small
                variant="danger"
                title={t('cancelClass')}
                onPress={() =>
                  Alert.alert(t('cancelClass'), t('cancelClassConfirm'), [
                    { text: t('keep'), style: 'cancel' },
                    { text: t('yesCancel'), style: 'destructive', onPress: () => run.mutate(() => api('POST', `/admin/sessions/${id}/cancel`, { body: {} })) },
                  ])
                }
              />
            </Row>
          ) : null}

          {adding ? (
            <Card style={{ marginTop: space.md }}>
              <ClientPicker
                onPick={(c) =>
                  run.mutate(async () => {
                    await api('POST', `/admin/sessions/${id}/bookings`, { body: { userId: c.id }, idempotencyKey: newIdempotencyKey() });
                    setAdding(false);
                  })
                }
              />
            </Card>
          ) : null}

          {editing ? (
            <Card style={{ marginTop: space.md }}>
              <Field label={t('capacity')} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder={String(s.capacity)} />
              <Field label="HH:mm" value={startTime} onChangeText={setStartTime} placeholder={time(s.startsAt)} />
              <Text variant="label">{t('instructor')}</Text>
              <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
                {(instructors.data ?? []).map((i) => (
                  <Chip key={i.id} label={i.name} active={(instructorId === undefined ? s.instructor?.id : instructorId) === i.id} onPress={() => setInstructorId(i.id)} />
                ))}
              </Row>
              <Button title={t('save')} onPress={saveEdit} loading={run.isPending} />
            </Card>
          ) : null}

          <Section title={`${t('participants')} (${s.bookings.filter((b) => b.status === 'BOOKED').length})`}>
            {s.bookings.map((b) => (
              <Card key={b.id} onPress={() => bookingMenu(b)} style={{ marginBottom: space.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{b.name}</Text>
                    <Text variant="small">{b.phone ?? ''}{b.source !== 'CLIENT' ? ` · ${b.source.toLowerCase()}` : ''}</Text>
                  </View>
                  <Row>
                    {b.attendance ? <Badge label={t(b.attendance as 'PRESENT')} tone={b.attendance === 'PRESENT' ? 'success' : 'danger'} /> : null}
                    <Badge label={t(b.status as 'BOOKED')} tone={b.status === 'BOOKED' ? 'wine' : 'neutral'} />
                  </Row>
                </Row>
              </Card>
            ))}
          </Section>
          {s.waitlist.length ? (
            <Section title={t('waitlist')}>
              {s.waitlist.map((w) => (
                <Row key={w.id} style={{ paddingVertical: 6 }}>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>{w.position}. {w.name}</Text>
                  <Badge label={t(w.status as 'WAITING')} tone={w.status === 'OFFERED' ? 'success' : 'warning'} />
                </Row>
              ))}
            </Section>
          ) : null}
          <Gap h={space.xl} />
        </>
      )}
    </Screen>
  );
}
