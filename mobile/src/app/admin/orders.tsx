import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Header, Row, Screen, Segmented, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { dateShort, lek } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { space } from '@/theme';

interface Order {
  id: string;
  reference: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  subtotal: number;
  discount: number;
  total: number;
  promotion: string | null;
  createdAt: string;
  client: { id: string; name: string; phone: string | null };
  product: string | null;
}

/** Packages reserved in the app wait here until the desk takes the money. Nothing is paid until someone says so. */
export default function AdminOrders() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang, tEnum } = useT();
  const [status, setStatus] = useState<'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED'>('PENDING');
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['admin-orders', status, search], queryFn: () => api<Order[]>('GET', `/admin/orders?status=${status}${search ? `&q=${encodeURIComponent(search)}` : ''}`) });
  const run = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-orders'] });
      void qc.invalidateQueries({ queryKey: ['admin-dash'] });
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const pay = (o: Order) =>
    Alert.alert(`${t('recordPayment')} · ${lek(o.total)}`, `${o.client.name} · ${o.product ?? ''} · ${o.reference}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('CASH'), onPress: () => run.mutate(() => api('POST', `/admin/orders/${o.id}/payments`, { body: { method: 'CASH' } })) },
      { text: t('CARD_AT_STUDIO'), onPress: () => run.mutate(() => api('POST', `/admin/orders/${o.id}/payments`, { body: { method: 'CARD_AT_STUDIO' } })) },
    ]);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('orders')} back />
      <Segmented options={(['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'] as const).map((s) => ({ value: s, label: tEnum(s) }))} value={status} onChange={setStatus} />
      <Field placeholder={`${t('search')} (DUA-…)`} value={search} onChangeText={setSearch} autoCapitalize="characters" style={{ marginTop: space.md }} />
      {q.isPending ? (
        <SkeletonList count={4} />
      ) : !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data.length ? (
        <EmptyState icon="credit-card" title={t('noBookings')} />
      ) : (
        q.data.map((o) => (
          <Card key={o.id} style={{ marginBottom: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{o.client.name}</Text>
                <Text variant="small">{o.product} · {o.reference}</Text>
                <Text variant="small">{dateShort(o.createdAt, lang)}{o.promotion ? ` · ${o.promotion} −${lek(o.discount)}` : ''}</Text>
              </View>
              <Text variant="heading">{lek(o.total)}</Text>
            </Row>
            <Row style={{ marginTop: space.sm, justifyContent: 'flex-end' }}>
              <Button small variant="ghost" title={t('client')} onPress={() => router.push({ pathname: '/admin/client/[id]', params: { id: o.client.id } })} />
              {o.status === 'PENDING' ? (
                <>
                  <Button small variant="danger" title={t('cancel')} onPress={() => run.mutate(() => api('POST', `/admin/orders/${o.id}/cancel`))} />
                  <Button small title={t('recordPayment')} onPress={() => pay(o)} />
                </>
              ) : (
                <Badge label={tEnum(o.status)} tone={o.status === 'PAID' ? 'success' : 'neutral'} />
              )}
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
