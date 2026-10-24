import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { DateStrip } from '@/components/DateStrip';
import { Badge, Button, Card, EmptyState, Field, Gap, Header, Row, Screen, Section, Segmented, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, studioInstant, todayISO, whenShort } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { space } from '@/theme';

type Kind = 'TIME_OFF' | 'CONFLICT' | 'AVAILABILITY_CHANGE';
interface Req {
  id: string;
  kind: Kind;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
}

const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Time off, a conflict, a change of hours: the studio decides, nothing moves by itself. */
export default function StaffRequests() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const [kind, setKind] = useState<Kind>('TIME_OFF');
  const [fromDate, setFromDate] = useState(addDays(todayISO(), 1));
  const [toDate, setToDate] = useState(addDays(todayISO(), 1));
  const [fromTime, setFromTime] = useState('00:00');
  const [toTime, setToTime] = useState('23:59');
  const [reason, setReason] = useState('');
  const q = useQuery({ queryKey: ['staff-requests'], queryFn: () => api<Req[]>('GET', '/staff/requests') });
  const send = useMutation({
    mutationFn: () =>
      api('POST', '/staff/requests', {
        body: { kind, startsAt: studioInstant(fromDate, fromTime).toISOString(), endsAt: studioInstant(toDate, toTime).toISOString(), reason: reason.trim() || undefined },
      }),
    onSuccess: () => {
      setReason('');
      void qc.invalidateQueries({ queryKey: ['staff-requests'] });
      Alert.alert(t('saved'));
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const valid = hhmm.test(fromTime) && hhmm.test(toTime) && `${toDate}${toTime}` > `${fromDate}${fromTime}`;

  return (
    <Screen>
      <Header title={t('requests')} back />
      <Card>
        <Text variant="heading">{t('newRequest')}</Text>
        <Gap h={space.sm} />
        <Segmented options={(['TIME_OFF', 'CONFLICT', 'AVAILABILITY_CHANGE'] as const).map((k) => ({ value: k, label: t(k) }))} value={kind} onChange={setKind} />
        <Gap h={space.md} />
        <Text variant="label">{t('from')}</Text>
        <DateStrip value={fromDate} onChange={(d) => { setFromDate(d); if (toDate < d) setToDate(d); }} />
        <Field value={fromTime} onChangeText={setFromTime} placeholder="HH:mm" keyboardType="numbers-and-punctuation" />
        <Text variant="label">{t('to')}</Text>
        <DateStrip value={toDate} onChange={setToDate} />
        <Field value={toTime} onChangeText={setToTime} placeholder="HH:mm" keyboardType="numbers-and-punctuation" />
        <Field label={t('reason')} value={reason} onChangeText={setReason} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }} />
        <Button title={t('send')} onPress={() => send.mutate()} loading={send.isPending} disabled={!valid} />
      </Card>
      <Section title={t('requests')}>
        {q.isPending ? (
          <SkeletonList count={3} />
        ) : !q.data?.length ? (
          <EmptyState icon="inbox" title={t('noNotifications')} />
        ) : (
          q.data.map((r) => (
            <Card key={r.id} style={{ marginBottom: space.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="heading">{t(r.kind)}</Text>
                <Badge label={t(r.status)} tone={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'} />
              </Row>
              <Text variant="small">{whenShort(r.startsAt, lang)} → {whenShort(r.endsAt, lang)}</Text>
              {r.reason ? <Text variant="body">{r.reason}</Text> : null}
              {r.reviewNote ? (
                <View style={{ marginTop: 4 }}>
                  <Text variant="small">↳ {r.reviewNote}</Text>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </Section>
    </Screen>
  );
}
