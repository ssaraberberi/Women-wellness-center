import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';
import { DateStrip } from '@/components/DateStrip';
import { Button, Card, Field, Gap, Header, Notice, Row, Screen, Section, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { dateShort, todayISO } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { space } from '@/theme';

/** Closing a day cancels its classes and SPA appointments, returns every credit and tells everyone. */
export default function Closures() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState('');
  const q = useQuery({ queryKey: ['admin-closures'], queryFn: () => api<{ id: string; date: string; reason: string | null }[]>('GET', '/admin/closures') });
  const run = useMutation({
    mutationFn: (fn: () => Promise<any>) => fn(),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['admin-closures'] });
      void qc.invalidateQueries({ queryKey: ['admin-sessions'] });
      if (r?.affectedClients !== undefined) Alert.alert(t('saved'), `${r.cancelledSessions} · ${r.affectedClients}`);
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  return (
    <Screen>
      <Header title={t('closures')} back />
      <Notice tone="warning" text={t('cancelClassConfirm')} />
      <Gap h={space.md} />
      <Card>
        <DateStrip value={date} onChange={setDate} />
        <Gap h={space.md} />
        <Field label={t('reason')} value={reason} onChangeText={setReason} />
        <Button
          variant="danger"
          title={`${t('closedDay')} · ${dateShort(`${date}T12:00:00Z`, lang)}`}
          onPress={() =>
            Alert.alert(t('closedDay'), t('cancelClassConfirm'), [
              { text: t('keep'), style: 'cancel' },
              { text: t('confirm'), style: 'destructive', onPress: () => run.mutate(() => api('POST', '/admin/closures', { body: { date, reason: reason.trim() || undefined } })) },
            ])
          }
          loading={run.isPending}
        />
      </Card>
      <Section title={t('closures')}>
        {(q.data ?? []).map((c) => (
          <Row key={c.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text variant="bodyMedium">{dateShort(`${c.date}T12:00:00Z`, lang)}{c.reason ? ` · ${c.reason}` : ''}</Text>
            <Button small variant="secondary" title={t('activate')} onPress={() => run.mutate(() => api('DELETE', `/admin/closures/${c.id}`))} />
          </Row>
        ))}
      </Section>
    </Screen>
  );
}
