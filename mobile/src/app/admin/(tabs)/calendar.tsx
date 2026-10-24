import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { ClassRow } from '@/components/ClassRow';
import { DateStrip } from '@/components/DateStrip';
import { Badge, Button, Card, EmptyState, ErrorState, Gap, Header, Row, Screen, Segmented, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { lek, time, todayISO } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import type { SessionDto } from '@/lib/types';
import { space } from '@/theme';

interface AdminAppt {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  price: number;
  paidWith: string;
  treatment: { id: string; name: string };
  room: { name: string };
  client: { name: string; phone: string | null };
  therapist: { name: string };
}

export default function AdminCalendar() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const [date, setDate] = useState(todayISO());
  const [tab, setTab] = useState<'pilates' | 'spa'>('pilates');
  const sq = useQuery({ queryKey: ['admin-sessions', date], queryFn: () => api<SessionDto[]>('GET', `/admin/sessions?from=${date}&to=${date}`), enabled: tab === 'pilates' });
  const aq = useQuery({ queryKey: ['admin-appts', date], queryFn: () => api<AdminAppt[]>('GET', `/admin/spa/appointments?from=${date}&to=${date}`), enabled: tab === 'spa' });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'cancel' | 'COMPLETED' | 'NO_SHOW' }) =>
      action === 'cancel' ? api('POST', `/admin/spa/appointments/${id}/cancel`, { body: { restoreEntitlement: true } }) : api('POST', `/admin/spa/appointments/${id}/outcome`, { body: { status: action } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-appts'] }),
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });

  const apptMenu = (a: AdminAppt) =>
    Alert.alert(`${a.treatment.name} · ${time(a.startsAt)}`, `${a.client.name}${a.client.phone ? ` · ${a.client.phone}` : ''}\n${a.therapist.name} · ${a.room.name}`, [
      { text: t('close'), style: 'cancel' },
      ...(a.status === 'BOOKED' && new Date(a.startsAt) <= new Date()
        ? [
            { text: t('complete'), onPress: () => act.mutate({ id: a.id, action: 'COMPLETED' }) },
            { text: t('noShow'), onPress: () => act.mutate({ id: a.id, action: 'NO_SHOW' }) },
          ]
        : []),
      ...(a.status === 'BOOKED' ? [{ text: t('cancel'), style: 'destructive' as const, onPress: () => act.mutate({ id: a.id, action: 'cancel' }) }] : []),
    ]);

  return (
    <Screen refreshing={sq.isRefetching || aq.isRefetching} onRefresh={() => void (tab === 'pilates' ? sq.refetch() : aq.refetch())}>
      <Header title={t('tabCalendar')} right={<Button small title={t('create')} icon="plus" onPress={() => router.push(tab === 'pilates' ? '/admin/session-new' : '/admin/spa-new')} />} />
      <Segmented options={[{ value: 'pilates', label: t('pilates') }, { value: 'spa', label: t('spa') }]} value={tab} onChange={setTab} />
      <Gap h={space.md} />
      <DateStrip value={date} onChange={setDate} />
      <Gap h={space.lg} />
      {tab === 'pilates' ? (
        sq.isPending ? (
          <SkeletonList count={5} />
        ) : sq.isError ? (
          <ErrorState error={sq.error} onRetry={() => void sq.refetch()} />
        ) : sq.data.length ? (
          sq.data.map((s) => (
            <View key={s.id}>
              <ClassRow s={{ ...s, myBookingId: null, myWaitlist: null }} onPress={() => router.push({ pathname: '/admin/session/[id]', params: { id: s.id } })} />
              <Text variant="caption" style={{ marginTop: -4, marginBottom: space.sm, marginLeft: space.lg }}>
                {s.booked}/{s.capacity}{s.waitlistCount ? ` · ${t('waitlist')} ${s.waitlistCount}` : ''}
              </Text>
            </View>
          ))
        ) : (
          <EmptyState icon="calendar" title={t('noClasses')} />
        )
      ) : aq.isPending ? (
        <SkeletonList count={4} />
      ) : aq.isError ? (
        <ErrorState error={aq.error} onRetry={() => void aq.refetch()} />
      ) : aq.data.length ? (
        aq.data.map((a) => (
          <Card key={a.id} onPress={() => apptMenu(a)} style={{ marginBottom: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{time(a.startsAt)}–{time(a.endsAt)} · {a.treatment.name}</Text>
                <Text variant="small">{a.client.name} · {a.therapist.name} · {a.room.name}</Text>
                <Text variant="caption">{a.paidWith === 'ENTITLEMENT' ? t('coveredByPackage') : `${t('payOnSite')} · ${lek(a.price)}`}</Text>
              </View>
              <Badge label={t(a.status as 'BOOKED')} tone={a.status === 'BOOKED' ? 'wine' : a.status === 'COMPLETED' ? 'success' : 'danger'} />
            </Row>
          </Card>
        ))
      ) : (
        <EmptyState icon="feather" title={t('noSlots')} />
      )}
    </Screen>
  );
}
