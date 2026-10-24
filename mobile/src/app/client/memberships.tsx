import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, EmptyState, ErrorState, Gap, Header, Row, Screen, Section, Segmented, SkeletonList, Stat, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { dateShort, lek } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { colors, space } from '@/theme';

interface Purchase {
  id: string;
  name: string;
  kind: string;
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING_PAYMENT';
  price: number;
  terms: string;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  credits: { total: number; remaining: number } | null;
  spa: { id: string; name: string; total: number; remaining: number }[];
  order: { id: string; reference: string; status: string; total: number; discount: number } | null;
}
interface Data {
  summary: { remainingCredits: number; totalCredits: number; usedCredits: number; nextExpiry: string | null };
  purchases: Purchase[];
}
interface Tx {
  id: string;
  type: string;
  delta: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
}

/** Current package, credits, what was bought, and every credit change — the ledger, as the studio sees it. */
export default function Memberships() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang, tEnum } = useT();
  const [view, setView] = useState<'packages' | 'history'>('packages');
  const q = useQuery({ queryKey: ['memberships'], queryFn: () => api<Data>('GET', '/me/memberships') });
  const tx = useQuery({ queryKey: ['credit-tx'], queryFn: () => api<Tx[]>('GET', '/me/credit-transactions'), enabled: view === 'history' });
  const cancel = useMutation({
    mutationFn: (orderId: string) => api('POST', `/orders/${orderId}/cancel`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['memberships'] }),
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const d = q.data;

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); void tx.refetch(); }}>
      <Header title={t('myMemberships')} back />
      {q.isPending ? (
        <SkeletonList count={3} height={100} />
      ) : !d ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <Row gap={space.md}>
            <Stat label={t('remaining')} value={d.summary.remainingCredits} sub={d.summary.nextExpiry ? t('expires', { date: dateShort(d.summary.nextExpiry, lang) }) : undefined} />
            <Stat label={t('used')} value={d.summary.usedCredits} sub={t('ofCredits', { n: d.summary.usedCredits, total: d.summary.totalCredits })} />
          </Row>
          <Gap h={space.lg} />
          <Segmented options={[{ value: 'packages', label: t('purchaseHistory') }, { value: 'history', label: t('creditHistory') }]} value={view} onChange={setView} />
          <Gap h={space.md} />
          {view === 'packages' ? (
            d.purchases.length ? (
              d.purchases.map((p) => (
                <Card key={p.id} style={{ marginBottom: space.md }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text variant="heading" style={{ flex: 1 }}>{p.name}</Text>
                    <Badge label={tEnum(p.status)} tone={p.status === 'ACTIVE' ? 'success' : p.status === 'PENDING_PAYMENT' ? 'warning' : 'neutral'} />
                  </Row>
                  <Text variant="small">
                    {lek(p.price)}
                    {p.order ? ` · ${p.order.reference}` : ''}
                    {p.expiresAt ? ` · ${t('expires', { date: dateShort(p.expiresAt, lang) })}` : ''}
                  </Text>
                  {p.credits ? (
                    <Text variant="bodyMedium" style={{ marginTop: space.sm }}>
                      {t('ofCredits', { n: p.credits.remaining, total: p.credits.total })}
                    </Text>
                  ) : null}
                  {p.spa.map((s) => (
                    <Text key={s.id} variant="small" style={{ color: colors.inkSoft }}>
                      {t('spaIncluded')}: {s.name} · {s.remaining}/{s.total}
                    </Text>
                  ))}
                  {p.status === 'PENDING_PAYMENT' && p.order ? (
                    <>
                      <Gap h={space.sm} />
                      <Text variant="small">{t('payAtStudio')}</Text>
                      <Gap h={space.sm} />
                      <Button small variant="danger" title={t('cancelOrder')} loading={cancel.isPending} onPress={() => cancel.mutate(p.order!.id)} />
                    </>
                  ) : null}
                  {p.status === 'EXPIRED' ? (
                    <>
                      <Gap h={space.sm} />
                      <Button small variant="secondary" title={t('renew')} onPress={() => router.push('/client/packages')} />
                    </>
                  ) : null}
                </Card>
              ))
            ) : (
              <EmptyState icon="package" title={t('noMembershipTitle')} body={t('noMembershipBody')} action={<Button title={t('seePackages')} onPress={() => router.push('/client/packages')} />} />
            )
          ) : tx.isPending ? (
            <SkeletonList count={5} height={56} />
          ) : (
            <Section title={t('creditHistory')}>
              {(tx.data ?? []).map((x) => (
                <Row key={x.id} style={{ paddingVertical: space.md, borderBottomWidth: 0.5, borderBottomColor: colors.line }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{tEnum(x.type)}</Text>
                    <Text variant="small">{dateShort(x.createdAt, lang)}{x.reason ? ` · ${x.reason}` : ''}</Text>
                  </View>
                  <Text variant="heading" style={{ color: x.delta > 0 ? colors.success : x.delta < 0 ? colors.wine : colors.muted }}>
                    {x.delta > 0 ? `+${x.delta}` : x.delta}
                  </Text>
                </Row>
              ))}
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}
