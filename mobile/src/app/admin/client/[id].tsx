import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, Chip, ErrorState, Field, Gap, Header, KeyValue, Row, Screen, Section, Segmented, SkeletonList, Text, ToggleRow } from '@/components/ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { dateShort, lek, whenShort } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { colors, space } from '@/theme';

interface ClientDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  remainingCredits: number;
  marketingConsent: boolean;
  purchases: { id: string; name: string; status: string; price: number; startsAt: string | null; expiresAt: string | null; wallet: { id: string; total: number; remaining: number } | null; spa: { id: string; name: string; total: number; remaining: number }[]; orderId: string | null; orderStatus: string | null }[];
  bookings: { id: string; sessionId: string; title: string; startsAt: string; status: string; attendance: string | null; creditsUsed: number; creditRefunded: boolean }[];
  spa: { id: string; title: string; startsAt: string; status: string; therapist: string; paidWith: string; price: number }[];
  orders: { id: string; reference: string; status: string; total: number; discount: number; createdAt: string; product: string | null; payments: { id: string; method: string; status: string; amount: number }[] }[];
  notes: { id: string; body: string; visibility: string; createdAt: string }[];
  transactions: { id: string; type: string; delta: number; balanceAfter: number; reason: string | null; createdAt: string }[];
}

type Panel = null | 'sell' | 'adjust' | 'note' | 'message';

/** Everything about one client, and what the desk can do for her. */
export default function AdminClient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang, tEnum } = useT();
  const [tab, setTab] = useState<'overview' | 'history' | 'ledger'>('overview');
  const [panel, setPanel] = useState<Panel>(null);
  const q = useQuery({ queryKey: ['admin-client', id], queryFn: () => api<ClientDetail>('GET', `/admin/clients/${id}`) });
  const products = useQuery({ queryKey: ['admin-products'], queryFn: () => api<Product[]>('GET', '/admin/products'), enabled: panel === 'sell' });
  const c = q.data;

  // panel state
  const [productId, setProductId] = useState<string | null>(null);
  const [promo, setPromo] = useState('');
  const [paidMethod, setPaidMethod] = useState<'CASH' | 'CARD_AT_STUDIO' | null>('CASH');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [delta, setDelta] = useState('1');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [noteService, setNoteService] = useState(false);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');

  const run = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-client', id] });
      void qc.invalidateQueries({ queryKey: ['admin-clients'] });
      void qc.invalidateQueries({ queryKey: ['admin-dash'] });
      setPanel(null);
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });

  const payOrder = (orderId: string, total: number) =>
    Alert.alert(t('recordPayment'), lek(total), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('CASH'), onPress: () => run.mutate(() => api('POST', `/admin/orders/${orderId}/payments`, { body: { method: 'CASH' } })) },
      { text: t('CARD_AT_STUDIO'), onPress: () => run.mutate(() => api('POST', `/admin/orders/${orderId}/payments`, { body: { method: 'CARD_AT_STUDIO' } })) },
    ]);

  if (q.isPending) return <Screen><Header title="" back /><SkeletonList count={6} /></Screen>;
  if (!c) return <Screen><Header title="" back /><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Screen>;
  const wallets = c.purchases.filter((p) => p.wallet && p.status === 'ACTIVE');

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={c.name} back subtitle={`${c.email}${c.phone ? ` · ${c.phone}` : ''}`} />
      <Row style={{ flexWrap: 'wrap' }}>
        <Badge label={t('creditsLeft', { n: c.remainingCredits })} tone="wine" />
        {c.status !== 'ACTIVE' ? <Badge label={tEnum(c.status)} tone="danger" /> : null}
        <Badge label={`${t('from')} ${dateShort(c.createdAt, lang)}`} />
      </Row>
      <Gap h={space.md} />
      <Row style={{ flexWrap: 'wrap' }}>
        <Button small icon="shopping-bag" title={t('assignPackage')} onPress={() => setPanel(panel === 'sell' ? null : 'sell')} />
        <Button small variant="secondary" icon="plus-circle" title={t('addCredits')} onPress={() => setPanel(panel === 'adjust' ? null : 'adjust')} disabled={!wallets.length} />
        <Button small variant="secondary" icon="message-circle" title={t('sendMessage')} onPress={() => setPanel(panel === 'message' ? null : 'message')} />
        <Button small variant="secondary" icon="edit-3" title={t('addNote')} onPress={() => setPanel(panel === 'note' ? null : 'note')} />
      </Row>

      {panel === 'sell' ? (
        <Card style={{ marginTop: space.md }}>
          <Row style={{ flexWrap: 'wrap' }}>
            {(products.data ?? []).filter((p) => p.active).map((p) => (
              <Chip key={p.id} label={`${p.name} · ${lek(p.price)}`} active={productId === p.id} onPress={() => setProductId(p.id)} />
            ))}
          </Row>
          <Gap h={space.sm} />
          <Field label={t('promoCode')} value={promo} onChangeText={(v) => setPromo(v.toUpperCase())} autoCapitalize="characters" />
          <Text variant="label">{t('paidNow')}</Text>
          <Row style={{ marginVertical: space.sm }}>
            <Chip label={t('CASH')} active={paidMethod === 'CASH'} onPress={() => setPaidMethod('CASH')} />
            <Chip label={t('CARD_AT_STUDIO')} active={paidMethod === 'CARD_AT_STUDIO'} onPress={() => setPaidMethod('CARD_AT_STUDIO')} />
            <Chip label={t('PENDING')} active={!paidMethod} onPress={() => setPaidMethod(null)} />
          </Row>
          <Button
            title={t('confirm')}
            disabled={!productId}
            loading={run.isPending}
            onPress={() =>
              run.mutate(() =>
                api('POST', `/admin/clients/${id}/assign-package`, {
                  body: { productId, ...(promo.trim() ? { promoCode: promo.trim() } : {}), ...(paidMethod ? { payment: { method: paidMethod } } : {}) },
                  idempotencyKey: newIdempotencyKey(),
                }),
              )
            }
          />
        </Card>
      ) : null}

      {panel === 'adjust' ? (
        <Card style={{ marginTop: space.md }}>
          <Row style={{ flexWrap: 'wrap' }}>
            {wallets.map((p) => (
              <Chip key={p.wallet!.id} label={`${p.name} (${p.wallet!.remaining})`} active={walletId === p.wallet!.id} onPress={() => setWalletId(p.wallet!.id)} />
            ))}
          </Row>
          <Gap h={space.sm} />
          <Field label="± credits" value={delta} onChangeText={setDelta} keyboardType="numbers-and-punctuation" />
          <Field label={t('reason')} value={reason} onChangeText={setReason} />
          <Button
            title={t('confirm')}
            disabled={!walletId || !reason.trim() || !/^-?\d+$/.test(delta) || Number(delta) === 0}
            loading={run.isPending}
            onPress={() => run.mutate(() => api('POST', `/admin/wallets/${walletId}/adjust`, { body: { delta: Number(delta), reason: reason.trim() }, idempotencyKey: newIdempotencyKey() }))}
          />
        </Card>
      ) : null}

      {panel === 'note' ? (
        <Card style={{ marginTop: space.md }}>
          <Field label={t('notes')} value={note} onChangeText={setNote} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }} />
          <ToggleRow label={t('service')} hint={t('canViewClientNotes')} value={noteService} onChange={setNoteService} />
          <Gap h={space.sm} />
          <Button title={t('save')} disabled={!note.trim()} loading={run.isPending} onPress={() => run.mutate(() => api('POST', `/admin/clients/${id}/notes`, { body: { body: note.trim(), visibility: noteService ? 'SERVICE' : 'INTERNAL' } }).then(() => setNote('')))} />
        </Card>
      ) : null}

      {panel === 'message' ? (
        <Card style={{ marginTop: space.md }}>
          <Field label={t('title')} value={msgTitle} onChangeText={setMsgTitle} />
          <Field label={t('message')} value={msgBody} onChangeText={setMsgBody} multiline />
          <Button title={t('send')} disabled={!msgTitle.trim() || !msgBody.trim()} loading={run.isPending} onPress={() => run.mutate(() => api('POST', `/admin/clients/${id}/notify`, { body: { title: msgTitle.trim(), body: msgBody.trim() } }))} />
        </Card>
      ) : null}

      <Gap h={space.lg} />
      <Segmented options={[{ value: 'overview', label: t('myMemberships') }, { value: 'history', label: t('bookingHistory') }, { value: 'ledger', label: t('creditHistory') }]} value={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <>
          <Section title={t('myMemberships')}>
            {c.purchases.map((p) => (
              <Card key={p.id} style={{ marginBottom: space.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="heading" style={{ flex: 1 }}>{p.name}</Text>
                  <Badge label={tEnum(p.status)} tone={p.status === 'ACTIVE' ? 'success' : p.status === 'PENDING_PAYMENT' ? 'warning' : 'neutral'} />
                </Row>
                <Text variant="small">{lek(p.price)}{p.expiresAt ? ` · ${t('expires', { date: dateShort(p.expiresAt, lang) })}` : ''}</Text>
                {p.wallet ? <Text variant="bodyMedium">{t('ofCredits', { n: p.wallet.remaining, total: p.wallet.total })}</Text> : null}
                {p.spa.map((s) => <Text key={s.id} variant="small">{s.name} · {s.remaining}/{s.total}</Text>)}
                {p.expiresAt ? (
                  <Row style={{ marginTop: space.sm }}>
                    {[7, 14, 30].map((d) => (
                      <Chip key={d} label={`+${d} ${t('days')}`} onPress={() => Alert.alert(t('extend'), `${p.name} +${d} ${t('days')}`, [{ text: t('cancel'), style: 'cancel' }, { text: t('confirm'), onPress: () => run.mutate(() => api('POST', `/admin/purchases/${p.id}/extend`, { body: { days: d } })) }])} />
                    ))}
                  </Row>
                ) : null}
              </Card>
            ))}
          </Section>
          <Section title={t('orders')}>
            {c.orders.map((o) => (
              <Card key={o.id} style={{ marginBottom: space.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{o.product ?? o.reference}</Text>
                    <Text variant="small">{o.reference} · {lek(o.total)}{o.discount ? ` (−${lek(o.discount)})` : ''} · {dateShort(o.createdAt, lang)}</Text>
                    {o.payments.map((p) => <Text key={p.id} variant="caption">{tEnum(p.method)} · {tEnum(p.status)} · {lek(p.amount)}</Text>)}
                  </View>
                  {o.status === 'PENDING' ? <Button small title={t('recordPayment')} onPress={() => payOrder(o.id, o.total)} /> : <Badge label={tEnum(o.status)} tone={o.status === 'PAID' ? 'success' : 'neutral'} />}
                </Row>
              </Card>
            ))}
          </Section>
          {c.notes.length ? (
            <Section title={t('notes')}>
              {c.notes.map((n) => (
                <Card key={n.id} style={{ marginBottom: space.sm }}>
                  <Text variant="body">{n.body}</Text>
                  <Text variant="caption">{n.visibility === 'SERVICE' ? t('service') : t('internal')} · {dateShort(n.createdAt, lang)}</Text>
                </Card>
              ))}
            </Section>
          ) : null}
          <Section title={t('settings')}>
            <KeyValue icon="mail" text={c.marketingConsent ? `${t('marketing')} ✓` : `${t('marketing')} ✗`} />
            <Row style={{ flexWrap: 'wrap', marginTop: space.sm }}>
              <Button
                small
                variant="secondary"
                title={c.status === 'DISABLED' ? t('activate') : t('deactivate')}
                onPress={() => run.mutate(() => api('PATCH', `/admin/clients/${id}`, { body: { status: c.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' } }))}
              />
              <Button
                small
                variant="danger"
                title={t('deleteClient')}
                onPress={() =>
                  Alert.alert(t('deleteClient'), t('deleteConfirm'), [
                    { text: t('keep'), style: 'cancel' },
                    { text: t('confirm'), style: 'destructive', onPress: () => run.mutate(async () => { await api('PATCH', `/admin/clients/${id}`, { body: { status: 'DELETED' } }); router.back(); }) },
                  ])
                }
              />
            </Row>
          </Section>
        </>
      ) : tab === 'history' ? (
        <Section title={t('bookingHistory')}>
          {c.bookings.map((b) => (
            <Card key={b.id} onPress={() => router.push({ pathname: '/admin/session/[id]', params: { id: b.sessionId } })} style={{ marginBottom: space.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="heading">{b.title}</Text>
                  <Text variant="small">{whenShort(b.startsAt, lang)}</Text>
                </View>
                <Row>
                  {b.attendance ? <Badge label={tEnum(b.attendance)} tone={b.attendance === 'PRESENT' ? 'success' : 'danger'} /> : null}
                  <Badge label={tEnum(b.status)} />
                </Row>
              </Row>
            </Card>
          ))}
          {c.spa.map((a) => (
            <Card key={a.id} style={{ marginBottom: space.sm }}>
              <Text variant="heading">SPA · {a.title}</Text>
              <Text variant="small">{whenShort(a.startsAt, lang)} · {a.therapist} · {tEnum(a.status)}</Text>
            </Card>
          ))}
        </Section>
      ) : (
        <Section title={t('creditHistory')}>
          {c.transactions.map((x) => (
            <Row key={x.id} style={{ paddingVertical: space.sm, borderBottomWidth: 0.5, borderBottomColor: colors.line }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{tEnum(x.type)}</Text>
                <Text variant="small">{dateShort(x.createdAt, lang)}{x.reason ? ` · ${x.reason}` : ''}</Text>
              </View>
              <Text variant="heading" style={{ color: x.delta > 0 ? colors.success : colors.wine }}>{x.delta > 0 ? `+${x.delta}` : x.delta}</Text>
            </Row>
          ))}
        </Section>
      )}
    </Screen>
  );
}
