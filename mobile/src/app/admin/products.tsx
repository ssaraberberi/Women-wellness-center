import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Badge, Button, Card, ErrorState, Header, Row, Screen, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { lek } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { space } from '@/theme';

export default function AdminProducts() {
  const router = useRouter();
  const { t, tEnum } = useT();
  const q = useQuery({ queryKey: ['admin-products'], queryFn: () => api<(Product & { _count: { purchases: number } })[]>('GET', '/admin/products') });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('products')} back right={<Button small icon="plus" title={t('create')} onPress={() => router.push({ pathname: '/admin/product/[id]', params: { id: 'new' } })} />} />
      {q.isPending ? (
        <SkeletonList count={6} />
      ) : !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        q.data.map((p) => (
          <Card key={p.id} onPress={() => router.push({ pathname: '/admin/product/[id]', params: { id: p.id } })} style={{ marginBottom: space.sm, opacity: p.active ? 1 : 0.6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{p.name}</Text>
                <Text variant="small">
                  {p.classCredits ? t('classesN', { n: p.classCredits }) : ''}
                  {p.spaItems.length ? ` + ${p.spaItems.map((s) => `${s.quantity}× ${s.treatment?.name ?? s.category}`).join(', ')}` : ''} · {t('validDays', { n: p.validityDays })}
                </Text>
                <Row style={{ marginTop: 4 }}>
                  <Badge label={tEnum(p.kind)} />
                  {!p.active ? <Badge label={t('inactive')} tone="warning" /> : null}
                  <Badge label={`${p._count.purchases}×`} />
                </Row>
              </View>
              <Text variant="heading">{lek(p.price)}</Text>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
