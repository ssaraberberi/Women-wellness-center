/* One class at the desk: its roster with attendance, who leads it,
   places held back, and cancelling it. Every write is the web desk's
   own endpoint, so the rules — credits returned, clients told — are too. */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as rules from '@shared/rules.js';
import { post } from '@/lib/api';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { longDate, startsAt } from '@/lib/format';
import { Button, Card, ErrorNote, Eyebrow, Loading, Row, Screen, Title, choose, confirm, st } from '@/components/ui';
import { Roster, type RosterRow } from '@/components/Roster';
import { C, R } from '@/lib/theme';

export default function AdminClass() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useT();
  const { data: s, loading, error, reload, refreshing } = useData<any>('/api/admin/state');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  if (loading) return <Loading />;
  const k = s?.classes.find((c: any) => c.id === id);
  if (!k) return <Screen><ErrorNote text={error || 'No such class'} /></Screen>;

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key); setNote(null);
    try { await fn(); await reload(); }
    catch (e: any) { setNote(e.message); }
    finally { setBusy(null); }
  };

  const sp = rules.spots(s, k);
  const started = startsAt(k.date, k.start) <= new Date();
  const lead = s.instructors.find((i: any) => i.id === k.instructorId);
  const client = (cid: string) => s.clients.find((c: any) => c.id === cid) || { name: '—', phone: null };
  const live = s.bookings.filter((b: any) => b.classId === k.id && (b.status === 'booked' || b.status === 'waitlist'));
  const rows: RosterRow[] = live.map((b: any) => ({ id: b.id, name: client(b.clientId).name, phone: client(b.clientId).phone,
                                                      attendance: b.attendance, status: b.status }));
  const reservationOf = (bid: string) => (s.bookings.find((b: any) => b.id === bid) || {}).reservationId;

  const mark = async (bookingId: string, v: 'attended' | 'noshow' | null) => {
    await post('/api/admin/bookings/' + bookingId + '/attendance', { attendance: v });
    await reload();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Title sub={longDate(k.date, lang, true) + ' · ' + k.start + '–' + k.end}>{t(rules.typeOf(s, k.typeId).name)}</Title>
      {k.cancelled ? <Text style={[st.body, { color: C.bad, marginBottom: 8 }]}>{t('This class was cancelled')}</Text> : null}
      <ErrorNote text={note} />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={st.muted}>{t('Led by')}</Text>
          <Pressable onPress={() => setPicking(p => !p)} disabled={k.cancelled}>
            <Text style={[st.body, { fontWeight: '600', color: lead ? C.ink : C.warn }]}>{lead ? lead.name : t('Nobody assigned')} ›</Text>
          </Pressable>
        </Row>
        {picking ? (
          <View style={{ marginTop: 10 }}>
            {rules.suggestInstructors(s, k).filter((x: any) => x.status !== 'removed').map((x: any) => (
              <Pressable key={x.instructor.id} disabled={x.status !== 'recommended' || busy === 'assign'}
                onPress={() => run('assign', async () => { await post('/api/admin/classes/' + k.id + '/assign', { instructorId: x.instructor.id }); setPicking(false); })}
                style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, opacity: x.status === 'recommended' ? 1 : 0.5 }}>
                <Text style={[st.body, { fontWeight: x.instructor.id === k.instructorId ? '700' : '400' }]}>{x.instructor.name}</Text>
                <Text style={st.muted}>{t(x.why)}</Text>
              </Pressable>
            ))}
            {k.instructorId ? <Button small kind="ghost" label="Leave unassigned"
              onPress={() => run('assign', async () => { await post('/api/admin/classes/' + k.id + '/assign', { instructorId: null }); setPicking(false); })} /> : null}
          </View>
        ) : null}
        <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <Text style={st.muted}>{t('Places')}</Text>
          <Text style={st.body}>{t('%s booked · %s left of %s', sp.taken, sp.left, k.capacity)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <Text style={st.muted}>{t('Held back')}</Text>
          <Row>
            {[-1, 1].map(d => (
              <Pressable key={d} disabled={k.cancelled || started || busy === 'block' || (d < 0 && !sp.blocked) || (d > 0 && !sp.left)}
                onPress={() => run('block', () => post('/api/admin/classes/' + k.id + '/block', { blocked: (k.blocked || 0) + d }))}
                style={{ width: 36, height: 36, borderRadius: R.control, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, color: C.wine }}>{d < 0 ? '−' : '+'}</Text>
              </Pressable>
            ))}
            <Text style={[st.body, { minWidth: 24, textAlign: 'center' }]}>{k.blocked || 0}</Text>
          </Row>
        </Row>
      </Card>

      <Eyebrow>Roster</Eyebrow>
      <Roster rows={rows} onMark={mark} canMark={!k.cancelled} />
      {rows.length ? (
        <View>
          {live.map((b: any) => (
            <Row key={b.id} style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={st.muted}>{client(b.clientId).name}</Text>
              <Row>
                {reservationOf(b.id) ? <Button small kind="ghost" label="Reservation"
                  onPress={() => router.push({ pathname: '/admin/reservation/[id]', params: { id: reservationOf(b.id) } })} /> : null}
                {b.status === 'booked' && !k.cancelled && !started ? <Button small kind="ghost" label="Cancel her place" busy={busy === b.id}
                  onPress={() => choose(t('Cancel her place?'), t('Give the class back to her package, or keep it as used?'), [
                    { text: t('Give it back'), onPress: () => run(b.id, () => post('/api/admin/bookings/' + b.id + '/cancel', { credit: 'return' })) },
                    { text: t('Keep it used'), danger: true, onPress: () => run(b.id, () => post('/api/admin/bookings/' + b.id + '/cancel', { credit: 'keep' })) }
                  ], t('Back'))} /> : null}
              </Row>
            </Row>
          ))}
        </View>
      ) : null}

      {!k.cancelled && !started ? (
        <>
          <View style={{ height: 16 }} />
          <Button kind="danger" label="Cancel the class" busy={busy === 'cancel'}
            onPress={() => confirm(t('Cancel the class'), t('%s booked. Everyone is told and gets the class back.', sp.taken),
              t('Cancel the class'), t('Keep it'), () => run('cancel', () => post('/api/admin/classes/' + k.id + '/cancel')))} />
        </>
      ) : null}
    </Screen>
  );
}
