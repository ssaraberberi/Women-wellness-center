/* One reservation at the desk: status and payment, each person's credits,
   and every class booked against it — attendance, cancel, give back. */
import { useState } from 'react';
import { Linking, Pressable, Share, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { API_URL, post, put } from '@/lib/api';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { longDate, money, shortDate } from '@/lib/format';
import { statusLabel } from '@/lib/catalogue';
import { Button, Card, ErrorNote, Eyebrow, Loading, Pill, Row, Screen, Segmented, Title, choose, confirm, st } from '@/components/ui';
import { C, R } from '@/lib/theme';

export default function AdminReservation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useT();
  const { data: r, setData, loading, error, refreshing, reload } = useData<any>('/api/admin/reservations/' + id);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (!r) return <Screen><ErrorNote text={error} /></Screen>;

  /* Every write answers with the reservation as it now stands. */
  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key); setNote(null);
    try { const v = await fn(); if (v && v.ref) setData(v); else await reload(); }
    catch (e: any) { setNote(e.message); }
    finally { setBusy(null); }
  };

  const shareLink = () => run('link', async () => {
    const l = await post('/api/admin/reservations/' + r.id + '/link');
    const url = API_URL + l.path;
    await Share.share({ message: t('Your DUA reservation %s: %s', l.ref, url) });
  });

  const step = (m: any, line: number, delta: number) =>
    run('credit' + m.membershipId + line, () => post('/api/admin/memberships/' + m.membershipId + '/credits', { delta, line }));

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Title sub={r.ref + ' · ' + shortDate(String(r.createdAt).slice(0, 10), lang)}>{r.title}</Title>
      <ErrorNote text={note} />

      <Eyebrow>Status</Eyebrow>
      <Segmented value={r.status} onChange={(v: string) => {
        const go = () => run('status', () => put('/api/admin/reservations/' + r.id, { status: v }));
        if (v === 'cancelled') confirm(t('Cancel the reservation?'), t('Its packages are cancelled and every place it still holds is freed.'), t('Cancel reservation'), t('Keep it'), go);
        else go();
      }} options={['pending', 'confirmed', 'completed', 'cancelled'].map(v => ({ value: v, label: statusLabel(v) }))} />
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Row>
          <Pill label={r.payment === 'paid' ? 'Paid' : 'Unpaid'} tone={r.payment === 'paid' ? 'good' : 'warn'} />
          {r.totalPrice != null ? <Text style={[st.body, { fontWeight: '600' }]}>{money(r.totalPrice, lang)}</Text> : null}
          {r.discountPct ? <Text style={st.muted}>−{r.discountPct}%</Text> : null}
        </Row>
        <Button small kind={r.payment === 'paid' ? 'secondary' : 'primary'} busy={busy === 'pay'}
          label={r.payment === 'paid' ? 'Mark unpaid' : 'Mark paid'}
          onPress={() => run('pay', () => put('/api/admin/reservations/' + r.id, { payment: r.payment === 'paid' ? 'unpaid' : 'paid' }))} />
      </Row>

      {r.people.map((p: any) => (
        <Card key={p.membershipId}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[st.h2, { marginBottom: 0, flex: 1 }]}>{p.name}</Text>
            {p.expired ? <Pill label="Expired" tone="neutral" /> : p.status === 'active' ? <Pill label="Active" tone="good" /> : <Pill label={p.status} />}
          </Row>
          <Row style={{ gap: 16, marginVertical: 4 }}>
            {p.phone ? <Text style={{ color: C.wine, fontWeight: '600' }} onPress={() => Linking.openURL('tel:' + p.phone.replace(/\s/g, ''))}>{p.phone}</Text> : null}
            {p.phone ? <Text style={{ color: C.wine, fontWeight: '600' }}
              onPress={() => Linking.openURL('https://wa.me/' + waNumber(p.phone))}>WhatsApp</Text> : null}
          </Row>
          <Text style={st.muted}>{longDate(p.start, lang, true)} – {longDate(p.end, lang)}</Text>
          {p.lines.map((l: any) => (
            <Row key={l.index} style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={st.body}>{l.label}</Text>
                <Text style={st.muted}>{l.left == null ? t('Unlimited') : t('%s used · %s left of %s', l.used, l.left, l.total)}</Text>
              </View>
              {l.total != null ? (
                <Row>
                  {[-1, 1].map(d => (
                    <Pressable key={d} onPress={() => step(p, l.index, d)} disabled={busy === 'credit' + p.membershipId + l.index || (d < 0 && !l.left)}
                      style={{ width: 36, height: 36, borderRadius: R.control, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18, color: C.wine }}>{d < 0 ? '−' : '+'}</Text>
                    </Pressable>
                  ))}
                </Row>
              ) : null}
            </Row>
          ))}
          {p.status === 'active' && !p.expired ? (
            <Button small kind="secondary" label="Book classes"
              onPress={() => router.push({ pathname: '/admin/book-classes', params: { membership: p.membershipId, reservation: r.id } })} />
          ) : null}
        </Card>
      ))}

      <Eyebrow>Classes</Eyebrow>
      {!r.bookings.length ? <Text style={st.muted}>{t('No classes booked on this reservation yet.')}</Text> : r.bookings.map((b: any) => {
        const who = r.people[b.person] ? r.people[b.person].name : '';
        const live = b.status === 'booked' && !b.classCancelled;
        return (
          <Card key={b.id} style={!live ? { opacity: 0.7 } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={[st.body, { fontWeight: '600' }]}>{longDate(b.date, lang, true)} · {b.start}</Text>
                <Text style={st.muted}>{t(b.typeName)}{b.instructor ? ' · ' + b.instructor : ''}{r.persons > 1 ? ' · ' + who : ''}</Text>
              </View>
              <Pill label={b.classCancelled ? 'Cancelled' : b.status === 'booked' ? (b.attendance === 'attended' ? 'Attended' : b.attendance === 'noshow' ? 'No-show' : 'Booked')
                : b.status === 'late' ? 'Late cancel' : 'Cancelled'} tone={live ? (b.attendance === 'noshow' ? 'bad' : 'good') : 'neutral'} />
            </Row>
            {live ? (
              <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
                {b.started ? (
                  <>
                    <Button small kind={b.attendance === 'attended' ? 'primary' : 'secondary'} label="Came" busy={busy === 'a' + b.id}
                      onPress={() => run('a' + b.id, () => post('/api/admin/bookings/' + b.id + '/attendance', { attendance: b.attendance === 'attended' ? null : 'attended' }))} />
                    <Button small kind={b.attendance === 'noshow' ? 'danger' : 'secondary'} label="No-show" busy={busy === 'n' + b.id}
                      onPress={() => run('n' + b.id, () => post('/api/admin/bookings/' + b.id + '/attendance', { attendance: b.attendance === 'noshow' ? null : 'noshow' }))} />
                  </>
                ) : (
                  <Button small kind="ghost" label="Cancel" busy={busy === 'c' + b.id}
                    onPress={() => choose(t('Cancel this class?'), b.canCancel ? t('Still inside the cancellation window.') : t('The cancellation window has passed.'), [
                      { text: t('Give it back'), onPress: () => run('c' + b.id, () => post('/api/admin/bookings/' + b.id + '/cancel', { credit: 'return' })) },
                      { text: t('Keep it used'), danger: true, onPress: () => run('c' + b.id, () => post('/api/admin/bookings/' + b.id + '/cancel', { credit: 'keep' })) }
                    ], t('Back'))} />
                )}
              </Row>
            ) : null}
            {(b.status === 'late' || (b.status === 'booked' && b.attendance === 'noshow')) ? (
              <Button small kind="ghost" label="Give the class back" busy={busy === 'r' + b.id}
                onPress={() => run('r' + b.id, () => post('/api/admin/bookings/' + b.id + '/restore'))} />
            ) : null}
          </Card>
        );
      })}

      <Eyebrow>Her private link</Eyebrow>
      <Text style={[st.muted, { marginBottom: 6 }]}>{t('A new link replaces the old one. Send it on WhatsApp so she can manage her classes on the website.')}</Text>
      <Button kind="secondary" label="Make a new link for her" busy={busy === 'link'} onPress={shareLink} />
    </Screen>
  );
}

/* wa.me wants the international number with no plus and no spaces. */
function waNumber(phone: string) {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '355' + d.slice(1);
  if (!d.startsWith('355')) d = '355' + d;
  return d;
}
