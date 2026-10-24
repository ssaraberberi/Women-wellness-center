import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { Badge, Button, Card, ErrorState, Gap, Header, KeyValue, Row, Screen, Section, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { longDate, time } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { space } from '@/theme';

interface Appt {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  treatment: { name: string; durationMin: number; category: string };
  room: string;
  client: string;
  serviceNotes: string | null;
  clientNotes: string[];
  canClose: boolean;
}

export default function StaffAppointment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['staff-appt', id], queryFn: () => api<Appt>('GET', `/staff/appointments/${id}`) });
  const outcome = useMutation({
    mutationFn: (status: 'COMPLETED' | 'NO_SHOW') => api('POST', `/staff/appointments/${id}/outcome`, { body: { status } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-appt', id] });
      void qc.invalidateQueries({ queryKey: ['staff-today'] });
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const a = q.data;
  return (
    <Screen>
      <Header title={a?.treatment.name ?? ''} back />
      {q.isPending ? (
        <SkeletonList count={4} height={40} />
      ) : !a ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <Row style={{ marginBottom: space.md }}>
            <Badge label={t(a.status as 'BOOKED')} tone={a.status === 'COMPLETED' ? 'success' : a.status === 'BOOKED' ? 'wine' : 'danger'} />
          </Row>
          <KeyValue icon="user" text={a.client} />
          <KeyValue icon="calendar" text={longDate(a.startsAt, lang)} />
          <KeyValue icon="clock" text={`${time(a.startsAt)} – ${time(a.endsAt)} · ${t('min', { n: a.treatment.durationMin })}`} />
          <KeyValue icon="home" text={`${t('room')}: ${a.room}`} />
          {a.serviceNotes || a.clientNotes.length ? (
            <Section title={t('serviceNotes')}>
              <Card>
                {a.serviceNotes ? <Text variant="body">{a.serviceNotes}</Text> : null}
                {a.clientNotes.map((n, i) => (
                  <Text key={i} variant="body">• {n}</Text>
                ))}
              </Card>
            </Section>
          ) : null}
          <Gap h={space.xl} />
          {a.canClose ? (
            <Row>
              <Button style={{ flex: 1 }} icon="check" title={t('complete')} onPress={() => outcome.mutate('COMPLETED')} loading={outcome.isPending && outcome.variables === 'COMPLETED'} />
              <Button style={{ flex: 1 }} variant="danger" title={t('noShow')} onPress={() => outcome.mutate('NO_SHOW')} loading={outcome.isPending && outcome.variables === 'NO_SHOW'} />
            </Row>
          ) : null}
        </>
      )}
    </Screen>
  );
}
