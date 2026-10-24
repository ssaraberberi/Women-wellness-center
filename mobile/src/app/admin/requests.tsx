import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Header, Notice, Row, Screen, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { whenShort } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { space } from '@/theme';

interface Req {
  id: string;
  kind: 'TIME_OFF' | 'CONFLICT' | 'AVAILABILITY_CHANGE';
  staffName: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  affectedSessions: number;
  affectedAppointments: number;
}

/** Approving time off is refused while bookings fall inside it: reassign or cancel them first. */
export default function AdminRequests() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['admin-requests'], queryFn: () => api<Req[]>('GET', '/admin/staff-requests') });
  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api('POST', `/admin/staff-requests/${id}/review`, { body: { approve } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-requests'] });
      void qc.invalidateQueries({ queryKey: ['admin-dash'] });
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('requests')} back />
      {q.isPending ? (
        <SkeletonList count={4} />
      ) : !q.data?.length ? (
        <EmptyState icon="inbox" title={t('noNotifications')} />
      ) : (
        q.data.map((r) => (
          <Card key={r.id} style={{ marginBottom: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{r.staffName} · {t(r.kind)}</Text>
                <Text variant="small">{whenShort(r.startsAt, lang)} → {whenShort(r.endsAt, lang)}</Text>
                {r.reason ? <Text variant="body">{r.reason}</Text> : null}
              </View>
              <Badge label={t(r.status)} tone={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'} />
            </Row>
            {r.status === 'PENDING' && (r.affectedSessions || r.affectedAppointments) ? (
              <Notice tone="warning" text={`${t('sessionsN', { n: r.affectedSessions })} · ${r.affectedAppointments} SPA`} />
            ) : null}
            {r.status === 'PENDING' ? (
              <Row style={{ marginTop: space.sm }}>
                <Button small style={{ flex: 1 }} title={t('approve')} onPress={() => review.mutate({ id: r.id, approve: true })} />
                <Button small style={{ flex: 1 }} variant="danger" title={t('reject')} onPress={() => review.mutate({ id: r.id, approve: false })} />
              </Row>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
