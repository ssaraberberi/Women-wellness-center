import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Alert } from '@/lib/alert';
import { Badge, Button, Card, Chip, Field, Header, Row, Screen, SkeletonList, Text, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import { lek } from '@/lib/format';
import { errorText, useT, type TKey } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { space } from '@/theme';

type Kind = 'DISCOUNT' | 'BUNDLE' | 'BONUS';
type When = 'BOOKED' | 'PAID' | 'FRIEND_PAID' | 'VISIT';

interface Offer {
  id: string;
  kind: Kind;
  title: string;
  discountPct: number | null;
  productId: string | null;
  product: { name: string; price: number; persons: number } | null;
  eligibleProductIds: string[];
  maxRedemptions: number | null;
  endsOn: string | null;
  newClientsOnly: boolean;
  bonusClasses: number;
  bonusWhen: When;
  friendRequired: boolean;
  active: boolean;
  archived: boolean;
  claimed: number;
}

const KIND_LABEL: Record<Kind, TKey> = { DISCOUNT: 'kindDiscount', BUNDLE: 'kindBundle', BONUS: 'kindBonus' };
const WHEN_LABEL: Record<When, TKey> = { BOOKED: 'BOOKED_WHEN', PAID: 'PAID_WHEN', FRIEND_PAID: 'FRIEND_PAID', VISIT: 'VISIT' };

/**
 * The offers the website and the app show: a discount on chosen packages
 * (FOUNDING GIRLS), a package of its own for two (DUA DUO), or bonus classes
 * with a friend (BRING A BESTIE). Switched on and off here; nothing is deleted.
 */
export default function AdminOffers() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['admin-offers'], queryFn: () => api<Offer[]>('GET', '/admin/offers') });
  const products = useQuery({ queryKey: ['admin-products'], queryFn: () => api<Product[]>('GET', '/admin/products') });
  const [open, setOpen] = useState(false);
  const blank = { kind: 'DISCOUNT' as Kind, title: '', pct: '15', productId: null as string | null, max: '', endsOn: '', newClientsOnly: false, bonusClasses: '1', bonusWhen: 'FRIEND_PAID' as When, friendRequired: true };
  const [f, setF] = useState(blank);
  const [eligible, setEligible] = useState<string[]>([]);
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-offers'] });
      void qc.invalidateQueries({ queryKey: ['catalogue'] });
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const valid =
    f.title.trim().length > 1 &&
    (f.kind !== 'DISCOUNT' || (Number(f.pct) >= 1 && Number(f.pct) <= 100)) &&
    (f.kind !== 'BUNDLE' || !!f.productId) &&
    (f.kind !== 'BONUS' || Number(f.bonusClasses) >= 1) &&
    (!f.endsOn || /^\d{4}-\d{2}-\d{2}$/.test(f.endsOn));
  const create = () =>
    run.mutate(async () => {
      await api('POST', '/admin/offers', {
        body: {
          kind: f.kind,
          title: f.title.trim(),
          discountPct: f.kind === 'DISCOUNT' ? Number(f.pct) : null,
          productId: f.kind === 'BUNDLE' ? f.productId : null,
          eligibleProductIds: f.kind === 'BUNDLE' ? [] : eligible,
          maxRedemptions: f.max ? Number(f.max) : null,
          endsOn: f.endsOn || null,
          newClientsOnly: f.newClientsOnly,
          bonusClasses: f.kind === 'BONUS' ? Number(f.bonusClasses) : 0,
          bonusWhen: f.bonusWhen,
          friendRequired: f.kind === 'BONUS' && f.friendRequired,
          active: true,
        },
      });
      setOpen(false);
      setF(blank);
      setEligible([]);
    });

  const all = products.data ?? [];
  const sellable = all.filter((p) => p.active && p.kind !== 'SINGLE' && p.persons === 1);
  const duos = all.filter((p) => p.persons === 2);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('offersAdmin')} back right={<Button small icon="plus" title={t('newOffer')} onPress={() => setOpen((v) => !v)} />} />
      {open ? (
        <Card style={{ marginBottom: space.lg }}>
          <Row style={{ flexWrap: 'wrap', marginBottom: space.sm }}>
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <Chip key={k} label={t(KIND_LABEL[k])} active={f.kind === k} onPress={() => setF({ ...f, kind: k })} />
            ))}
          </Row>
          <Field label={t('title')} value={f.title} onChangeText={(v) => setF({ ...f, title: v })} placeholder={f.kind === 'DISCOUNT' ? 'FOUNDING GIRLS' : f.kind === 'BUNDLE' ? 'DUA DUO' : 'BRING A BESTIE'} />
          {f.kind === 'DISCOUNT' ? <Field label={t('pctOff')} value={f.pct} onChangeText={(v) => setF({ ...f, pct: v.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" /> : null}
          {f.kind === 'BONUS' ? (
            <>
              <Field label={t('bonusClassesN')} value={f.bonusClasses} onChangeText={(v) => setF({ ...f, bonusClasses: v.replace(/\D/g, '').slice(0, 2) })} keyboardType="number-pad" />
              <Text variant="label">{t('bonusWhen')}</Text>
              <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
                {(Object.keys(WHEN_LABEL) as When[]).map((w) => (
                  <Chip key={w} label={t(WHEN_LABEL[w])} active={f.bonusWhen === w} onPress={() => setF({ ...f, bonusWhen: w })} />
                ))}
              </Row>
              <ToggleRow label={t('friendRequired')} value={f.friendRequired} onChange={(v) => setF({ ...f, friendRequired: v })} />
            </>
          ) : null}
          <Text variant="label" style={{ marginTop: space.sm }}>{f.kind === 'BUNDLE' ? t('bundlePackage') : t('appliesTo')}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {f.kind === 'BUNDLE'
              ? duos.map((p) => <Chip key={p.id} label={`${p.name} · ${lek(p.price)}`} active={f.productId === p.id} onPress={() => setF({ ...f, productId: p.id })} />)
              : sellable.map((p) => (
                  <Chip key={p.id} label={p.name} active={eligible.includes(p.id)} onPress={() => setEligible(eligible.includes(p.id) ? eligible.filter((x) => x !== p.id) : [...eligible, p.id])} />
                ))}
          </Row>
          {f.kind === 'BUNDLE' && !duos.length ? <Text variant="small">{t('needDuoPackage')}</Text> : null}
          <Field label={t('maxUses')} value={f.max} onChangeText={(v) => setF({ ...f, max: v.replace(/\D/g, '') })} keyboardType="number-pad" />
          <Field label={t('endsOn')} value={f.endsOn} onChangeText={(v) => setF({ ...f, endsOn: v.trim() })} placeholder="2026-12-31" autoCapitalize="none" />
          <ToggleRow label={t('newClientsOnly')} value={f.newClientsOnly} onChange={(v) => setF({ ...f, newClientsOnly: v })} />
          <Button title={t('create')} onPress={create} loading={run.isPending} disabled={!valid} />
        </Card>
      ) : null}
      {q.isPending ? (
        <SkeletonList count={3} />
      ) : (
        (q.data ?? [])
          .filter((o) => !o.archived)
          .map((o) => (
            <Card key={o.id} style={{ marginBottom: space.sm, opacity: o.active ? 1 : 0.6 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="heading">{o.title}</Text>
                  <Text variant="small">
                    {t(KIND_LABEL[o.kind])}
                    {o.kind === 'DISCOUNT' ? ` · ${t('offerPct', { pct: o.discountPct ?? 0 })}` : ''}
                    {o.kind === 'BUNDLE' && o.product ? ` · ${o.product.name} · ${lek(o.product.price)}` : ''}
                    {o.kind === 'BONUS' ? ` · ${t('offerBonus', { n: o.bonusClasses })} · ${t(WHEN_LABEL[o.bonusWhen])}` : ''}
                  </Text>
                  <Text variant="small">
                    {t('usedN', { n: `${o.claimed}${o.maxRedemptions ? `/${o.maxRedemptions}` : ''}` })}
                    {o.endsOn ? ` · ${o.endsOn}` : ''}
                  </Text>
                  <Row style={{ marginTop: 4, flexWrap: 'wrap' }}>
                    {o.newClientsOnly ? <Badge label={t('newClientsOnly')} /> : null}
                    {o.eligibleProductIds.map((id) => {
                      const p = all.find((x) => x.id === id);
                      return p ? <Badge key={id} label={p.name} /> : null;
                    })}
                  </Row>
                </View>
                <View style={{ gap: space.xs }}>
                  <Button small variant="secondary" title={o.active ? t('deactivate') : t('activate')} onPress={() => run.mutate(() => api('PATCH', `/admin/offers/${o.id}`, { body: { active: !o.active } }))} />
                  <Button small variant="ghost" title={t('archive')} onPress={() => run.mutate(() => api('PATCH', `/admin/offers/${o.id}`, { body: { archived: true, active: false } }))} />
                </View>
              </Row>
            </Card>
          ))
      )}
    </Screen>
  );
}
