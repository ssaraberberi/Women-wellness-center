import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { Badge, Button, Card, Chip, ErrorState, Field, Gap, Header, KeyValue, Row, Screen, Section, Segmented, SkeletonList, Text, ToggleRow } from '@/components/ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { SPA_ENABLED } from '@/lib/features';
import { DateStrip } from '@/components/DateStrip';
import { PayDialog, type PayTarget } from '@/components/PayDialog';
import { addDays, dateShort, lek, longDate, manualDiscountAmount, time, tirane, todayISO, whenShort } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import type { Product, SessionDto } from '@/lib/types';
import { colors, space } from '@/theme';

interface ClientDetail {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
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
  visits: { date: string; title: string | null; sessionId: string | null }[];
}

// Sessions come only from selling a package; there is no manual add / deduct.
type Panel = null | 'sell' | 'note' | 'visit';

/** Everything about one client, and what the desk can do for her. */
export default function AdminClient() {
  const { id, code: createdCode } = useLocalSearchParams<{ id: string; code?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang, tEnum } = useT();
  // Her sign-in code: only ever shown right after it is made (it is stored hashed).
  const [loginCode, setLoginCode] = useState<string | null>(createdCode ?? null);
  const [tab, setTab] = useState<'overview' | 'history' | 'ledger'>('overview');
  const [panel, setPanel] = useState<Panel>(null);
  const q = useQuery({ queryKey: ['admin-client', id], queryFn: () => api<ClientDetail>('GET', `/admin/clients/${id}`) });
  const products = useQuery({ queryKey: ['admin-products'], queryFn: () => api<Product[]>('GET', '/admin/products'), enabled: panel === 'sell' });
  const c = q.data;

  // panel state
  const [productId, setProductId] = useState<string | null>(null);
  const [discType, setDiscType] = useState<'PERCENT' | 'AMOUNT' | null>(null);
  const [discValue, setDiscValue] = useState('');
  const selected = products.data?.find((p) => p.id === productId);
  const discount = selected && discType && discValue ? manualDiscountAmount(selected.price, discType, Number(discValue)) : 0;
  const [paidMethod, setPaidMethod] = useState<'CASH' | null>('CASH'); // the studio takes cash only
  const [note, setNote] = useState('');
  const [noteService, setNoteService] = useState(false);
  // A day she came, written in afterwards: one of that day's classes, or just the day.
  const [visitDay, setVisitDay] = useState(addDays(todayISO(), -1));
  const dayClasses = useQuery({ queryKey: ['admin-sessions', visitDay], queryFn: () => api<SessionDto[]>('GET', `/admin/sessions?from=${visitDay}&to=${visitDay}`), enabled: panel === 'visit' });
  // Stays open after each one: several days are often written in together.
  const visit = useMutation({
    mutationFn: (body: { sessionId: string } | { date: string }) => api('POST', `/admin/clients/${id}/visits`, { body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-client', id] });
      Alert.alert('DUA', t('visitAdded'));
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const addVisit = (body: { sessionId: string } | { date: string }) => visit.mutate(body);
  // A package's start and end, edited one at a time on the same calendar.
  const [dates, setDates] = useState<{ id: string; which: 'start' | 'end'; start: string; end: string } | null>(null);

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

  const [paying, setPaying] = useState<PayTarget | null>(null);
  const payOrder = (orderId: string, total: number, title?: string) => setPaying({ orderId, total, title });
  const paid = () => {
    void qc.invalidateQueries({ queryKey: ['admin-client', id] });
    void qc.invalidateQueries({ queryKey: ['admin-clients'] });
    void qc.invalidateQueries({ queryKey: ['admin-dash'] });
  };

  if (q.isPending) return <Screen><Header title="" back /><SkeletonList count={6} /></Screen>;
  if (!c) return <Screen><Header title="" back /><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Screen>;

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <PayDialog target={paying} onClose={() => setPaying(null)} onPaid={paid} />
      <Header title={c.name} back subtitle={[c.email, c.phone].filter(Boolean).join(' · ')} />
      <Row style={{ flexWrap: 'wrap' }}>
        <Badge label={t('creditsLeft', { n: c.remainingCredits })} tone="wine" />
        {c.status !== 'ACTIVE' ? <Badge label={tEnum(c.status)} tone="danger" /> : null}
        <Badge label={`${t('from')} ${dateShort(c.createdAt, lang)}`} />
      </Row>
      <Gap h={space.md} />
      <Card style={{ marginBottom: space.md }}>
        <Text variant="label">{t('loginCode')}</Text>
        {c.username ? <KeyValue icon="user" text={`${t('username')}: ${c.username}`} /> : null}
        {loginCode ? (
          <>
            <Text variant="small" style={{ marginVertical: space.xs }}>{t('loginCodeHint')}</Text>
            <Text variant="title" selectable style={{ letterSpacing: 1, marginVertical: space.xs }}>{loginCode}</Text>
            <Button
              small
              icon="send"
              title={t('sendLoginCode')}
              onPress={() => void Share.share({ message: t('loginMessage', { name: c.name.split(' ')[0], login: c.username ?? c.email ?? '', code: loginCode, link: 'https://dua-pilates.com/book' }) })}
            />
          </>
        ) : (
          <>
            <Text variant="small" style={{ marginVertical: space.xs }}>{t('loginCodeNone')}</Text>
            <Button
              small
              variant="secondary"
              icon="key"
              title={t('newLoginCode')}
              onPress={() =>
                Alert.alert(t('newLoginCode'), t('newLoginCodeConfirm'), [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('confirm'), onPress: () => run.mutate(async () => setLoginCode((await api<{ password: string }>('POST', `/admin/clients/${id}/login-code`)).password)) },                ])
              }
            />
          </>
        )}
      </Card>
      <Row style={{ flexWrap: 'wrap' }}>
        <Button small icon="shopping-bag" title={t('assignPackage')} onPress={() => setPanel(panel === 'sell' ? null : 'sell')} />        <Button small variant="secondary" icon="check-circle" title={t('addVisit')} onPress={() => setPanel(panel === 'visit' ? null : 'visit')} />
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
          <Text variant="label">{t('discount')}</Text>
          <Row style={{ marginVertical: space.sm }}>
            <Chip label={t('noDiscount')} active={!discType} onPress={() => setDiscType(null)} />
            <Chip label="%" active={discType === 'PERCENT'} onPress={() => setDiscType('PERCENT')} />
            <Chip label={t('amountOff')} active={discType === 'AMOUNT'} onPress={() => setDiscType('AMOUNT')} />
          </Row>
          {discType ? (
            <Field
              label={discType === 'PERCENT' ? t('percentOff') : t('lekOff')}
              value={discValue}
              onChangeText={(v) => setDiscValue(v.replace(/\D/g, '').slice(0, discType === 'PERCENT' ? 3 : 7))}
              keyboardType="number-pad"
              placeholder={discType === 'PERCENT' ? '15' : '2000'}
            />
          ) : null}
          {selected ? (
            <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
              <Text variant="body">{t('total')}</Text>
              <Text variant="heading">
                {discount ? `${lek(selected.price)} → ${lek(selected.price - discount)}` : lek(selected.price)}
              </Text>
            </Row>
          ) : null}
          <Text variant="label">{t('paidNow')}</Text>
          <Row style={{ marginVertical: space.sm }}>
            <Chip label={t('CASH')} active={paidMethod === 'CASH'} onPress={() => setPaidMethod('CASH')} />            <Chip label={t('PENDING')} active={!paidMethod} onPress={() => setPaidMethod(null)} />
          </Row>
          <Button
            title={t('confirm')}
            disabled={!productId || (discType === 'PERCENT' && Number(discValue) > 100)}
            loading={run.isPending}
            onPress={() =>
              run.mutate(() =>
                api('POST', `/admin/clients/${id}/assign-package`, {
                  body: { productId, ...(discount ? { discount: { type: discType, value: Number(discValue) } } : {}), ...(paidMethod ? { payment: { method: paidMethod } } : {}) },
                  idempotencyKey: newIdempotencyKey(),
                }),
              )
            }
          />
        </Card>
      ) : null}

      {panel === 'visit' ? (
        <Card style={{ marginTop: space.md }}>
          <Text variant="small" style={{ marginBottom: space.sm }}>{t('addVisitHint')}</Text>
          <DateStrip value={visitDay} onChange={setVisitDay} allowPast maxDate={todayISO()} marks />
          <Text variant="label" style={{ marginTop: space.md }}>{longDate(visitDay, lang)}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {(dayClasses.data ?? [])
              .filter((s) => s.status !== 'CANCELLED' && new Date(s.startsAt) <= new Date())
              .map((s) => (
                <Chip key={s.id} label={`${time(s.startsAt)} · ${s.classType.name}`} onPress={() => addVisit({ sessionId: s.id })} />
              ))}
          </Row>
          <Button small variant="ghost" title={t('visitNoClass')} loading={visit.isPending} onPress={() => addVisit({ date: visitDay })} />
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
                <Text variant="small">
                  {lek(p.price)}
                  {p.startsAt ? ` · ${t('startsOnDay', { date: dateShort(p.startsAt, lang) })}` : ''}
                  {p.expiresAt ? ` · ${t('expires', { date: dateShort(p.expiresAt, lang) })}` : ''}
                </Text>
                {p.wallet ? <Text variant="bodyMedium">{t('ofCredits', { n: p.wallet.remaining, total: p.wallet.total })}</Text> : null}
                {p.expiresAt && dates?.id !== p.id ? (
                  <Button
                    small
                    variant="ghost"
                    icon="calendar"
                    title={t('changeDates')}
                    onPress={() => setDates({ id: p.id, which: 'end', start: tirane(p.startsAt ?? p.expiresAt!).iso, end: tirane(p.expiresAt!).iso })}
                    style={{ alignSelf: 'flex-start' }}
                  />
                ) : null}
                {dates?.id === p.id ? (
                  <View style={{ marginTop: space.sm }}>
                    <Row style={{ marginBottom: space.sm }}>
                      <Chip label={t('startsOnDay', { date: dateShort(dates.start, lang) })} active={dates.which === 'start'} onPress={() => setDates({ ...dates, which: 'start' })} />
                      <Chip label={t('endsOnDay', { date: dateShort(dates.end, lang) })} active={dates.which === 'end'} onPress={() => setDates({ ...dates, which: 'end' })} />
                    </Row>
                    <DateStrip key={dates.which} value={dates.which === 'start' ? dates.start : dates.end} onChange={(d) => setDates({ ...dates, [dates.which]: d })} allowPast />
                    <Row style={{ marginTop: space.sm }}>
                      <Button
                        small
                        title={t('save')}
                        disabled={dates.end < dates.start}
                        loading={run.isPending}
                        onPress={() => run.mutate(() => api('PATCH', `/admin/purchases/${p.id}`, { body: { startsOn: dates.start, expiresOn: dates.end } }).then(() => setDates(null)))}
                      />
                      <Button small variant="ghost" title={t('cancel')} onPress={() => setDates(null)} />
                    </Row>
                  </View>
                ) : null}
                {(SPA_ENABLED ? p.spa : []).map((s) => <Text key={s.id} variant="small">{s.name} · {s.remaining}/{s.total}</Text>)}
              </Card>
            ))}
          </Section>
          <Section title={t('payments')}>
            {c.orders.map((o) => (
              <Card key={o.id} style={{ marginBottom: space.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{o.product ?? o.reference}</Text>
                    <Text variant="small">{o.reference} · {lek(o.total)}{o.discount ? ` (−${lek(o.discount)})` : ''} · {dateShort(o.createdAt, lang)}</Text>
                    {o.payments.map((p) => <Text key={p.id} variant="caption">{tEnum(p.method)} · {tEnum(p.status)} · {lek(p.amount)}</Text>)}
                  </View>
                  {o.status === 'PENDING' ? <Button small title={t('recordPayment')} onPress={() => payOrder(o.id, o.total, o.product ?? o.reference)} /> : <Badge label={tEnum(o.status)} tone={o.status === 'PAID' ? 'success' : 'neutral'} />}
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
          {c.visits.length ? (
            <Card style={{ marginBottom: space.md }}>
              <Text variant="label">{t('daysCame', { n: c.visits.length })}</Text>
              {c.visits.map((v, i) => (
                <Text key={`${v.date}-${i}`} variant="small">
                  {longDate(v.date, lang)}{v.title ? ` · ${v.title}` : ''}
                </Text>
              ))}
            </Card>
          ) : null}
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
          {(SPA_ENABLED ? c.spa : []).map((a) => (
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
