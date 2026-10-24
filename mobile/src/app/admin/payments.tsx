import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, View } from 'react-native';
import { Badge, Card, EmptyState, ErrorState, Header, Row, Screen, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { lek, whenShort } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { space } from '@/theme';

interface Payment {
  id: string;
  method: string;
  status: string;
  amount: number;
  refunded: number;
  createdAt: string;
  note: string | null;
  reference: string;
  client: string;
  product: string | null;
}

export default function AdminPayments() {
  const qc = useQueryClient();
  const { t, lang, tEnum } = useT();
  const q = useQuery({ queryKey: ['admin-payments'], queryFn: () => api<Payment[]>('GET', '/admin/payments') });
  const refund = useMutation({
    mutationFn: (p: Payment) => api('POST', `/admin/payments/${p.id}/refund`, { body: { amount: p.amount - p.refunded, cancelPurchase: true } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-payments'] }),
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('payments')} back />
      {q.isPending ? (
        <SkeletonList count={5} />
      ) : !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data.length ? (
        <EmptyState icon="dollar-sign" title={t('noBookings')} />
      ) : (
        q.data.map((p) => (
          <Card
            key={p.id}
            style={{ marginBottom: space.sm }}
            onPress={
              p.status === 'COMPLETED'
                ? () =>
                    Alert.alert(t('refund'), `${p.client} · ${lek(p.amount - p.refunded)}\n${lang === 'sq' ? 'Kreditet e mbetura të paketës hiqen.' : 'Remaining package credits are withdrawn.'}`, [
                      { text: t('cancel'), style: 'cancel' },
                      { text: t('refund'), style: 'destructive', onPress: () => refund.mutate(p) },
                    ])
                : undefined
            }
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{p.client}</Text>
                <Text variant="small">{p.product} · {p.reference} · {tEnum(p.method)}</Text>
                <Text variant="caption">{whenShort(p.createdAt, lang)}{p.note ? ` · ${p.note}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="heading">{lek(p.amount)}</Text>
                {p.refunded ? <Text variant="small">−{lek(p.refunded)}</Text> : null}
                <Badge label={tEnum(p.status)} tone={p.status === 'COMPLETED' ? 'success' : 'neutral'} />
              </View>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
