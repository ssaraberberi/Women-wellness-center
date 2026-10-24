import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Header, Row, Screen, SkeletonList, Text, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import { dateShort, lek } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { space } from '@/theme';

interface Promo {
  id: string;
  code: string;
  description: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  firstTimeOnly: boolean;
  maxRedemptions: number | null;
  redemptionCount: number;
  validUntil: string | null;
  active: boolean;
  products: { product: { id: string; name: string } }[];
}

export default function AdminPromotions() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['admin-promos'], queryFn: () => api<Promo[]>('GET', '/admin/promotions') });
  const products = useQuery({ queryKey: ['admin-products'], queryFn: () => api<Product[]>('GET', '/admin/products') });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: '', description: '', discountType: 'PERCENT' as 'PERCENT' | 'FIXED', discountValue: '10', firstTimeOnly: false, maxRedemptions: '', days: '' });
  const [productIds, setProductIds] = useState<string[]>([]);
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-promos'] });
      setOpen(false);
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const create = () =>
    run.mutate(() =>
      api('POST', '/admin/promotions', {
        body: {
          code: f.code.trim().toUpperCase(),
          description: f.description,
          discountType: f.discountType,
          discountValue: Number(f.discountValue || 0),
          firstTimeOnly: f.firstTimeOnly,
          maxRedemptions: f.maxRedemptions ? Number(f.maxRedemptions) : null,
          validUntil: f.days ? new Date(Date.now() + Number(f.days) * 86_400_000).toISOString() : null,
          productIds,
        },
      }),
    );

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('promotions')} back right={<Button small icon="plus" title={t('create')} onPress={() => setOpen((v) => !v)} />} />
      {open ? (
        <Card style={{ marginBottom: space.lg }}>
          <Field label={t('code')} value={f.code} onChangeText={(v) => setF({ ...f, code: v.toUpperCase() })} autoCapitalize="characters" />
          <Field label={t('description')} value={f.description} onChangeText={(v) => setF({ ...f, description: v })} />
          <Row style={{ marginBottom: space.sm }}>
            <Chip label={t('PERCENT')} active={f.discountType === 'PERCENT'} onPress={() => setF({ ...f, discountType: 'PERCENT' })} />
            <Chip label={t('FIXED')} active={f.discountType === 'FIXED'} onPress={() => setF({ ...f, discountType: 'FIXED' })} />
          </Row>
          <Row>
            <Field label={f.discountType === 'PERCENT' ? '%' : 'L'} value={f.discountValue} onChangeText={(v) => setF({ ...f, discountValue: v.replace(/\D/g, '') })} keyboardType="number-pad" style={{ width: 90 }} />
            <Field label={t('maxRedemptions')} value={f.maxRedemptions} onChangeText={(v) => setF({ ...f, maxRedemptions: v.replace(/\D/g, '') })} keyboardType="number-pad" style={{ width: 120 }} />
            <Field label={t('days')} value={f.days} onChangeText={(v) => setF({ ...f, days: v.replace(/\D/g, '') })} keyboardType="number-pad" style={{ width: 70 }} />
          </Row>
          <ToggleRow label={t('firstTimeOnly')} value={f.firstTimeOnly} onChange={(v) => setF({ ...f, firstTimeOnly: v })} />
          <Text variant="label" style={{ marginTop: space.sm }}>{t('products')} ({t('all').toLowerCase()} = —)</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {(products.data ?? []).filter((p) => p.active).map((p) => (
              <Chip key={p.id} label={p.name} active={productIds.includes(p.id)} onPress={() => setProductIds(productIds.includes(p.id) ? productIds.filter((x) => x !== p.id) : [...productIds, p.id])} />
            ))}
          </Row>
          <Button title={t('create')} onPress={create} loading={run.isPending} disabled={f.code.trim().length < 3 || !f.discountValue} />
        </Card>
      ) : null}
      {q.isPending ? (
        <SkeletonList count={3} />
      ) : (
        (q.data ?? []).map((p) => (
          <Card key={p.id} style={{ marginBottom: space.sm, opacity: p.active ? 1 : 0.6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{p.code}</Text>
                <Text variant="small">
                  {p.discountType === 'PERCENT' ? `${p.discountValue}%` : lek(p.discountValue)} · {t('redeemed', { n: `${p.redemptionCount}${p.maxRedemptions ? `/${p.maxRedemptions}` : ''}` })}
                  {p.validUntil ? ` · ${t('expires', { date: dateShort(p.validUntil, lang) })}` : ''}
                </Text>
                {p.description ? <Text variant="small">{p.description}</Text> : null}
                <Row style={{ marginTop: 4, flexWrap: 'wrap' }}>
                  {p.firstTimeOnly ? <Badge label={t('firstTimeOnly')} /> : null}
                  {p.products.map((x) => <Badge key={x.product.id} label={x.product.name} />)}
                </Row>
              </View>
              <Button small variant="secondary" title={p.active ? t('deactivate') : t('activate')} onPress={() => run.mutate(() => api('PATCH', `/admin/promotions/${p.id}`, { body: { active: !p.active } }))} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
