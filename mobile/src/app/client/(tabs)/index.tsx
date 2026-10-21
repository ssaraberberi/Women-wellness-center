/* Her home: the classes she has coming, and what is left in her package. */
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import * as rules from '@shared/rules.js';
import { post } from '@/lib/api';
import { useData } from '@/lib/useData';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { longDate, startsAt } from '@/lib/format';
import { scheduleReminders } from '@/lib/push';
import { Body, Button, Card, Empty, ErrorNote, Eyebrow, Loading, Pill, Row, Screen, Title, confirm, st } from '@/components/ui';
import { ClassCard } from '@/components/ClassCard';
import { C } from '@/lib/theme';

export default function ClientHome() {
  const { user } = useSession();
  const { t, lang } = useT();
  const { data: s, error, loading, refreshing, reload } = useData<any>('/api/client/state');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const now = new Date();

  const upcoming = useMemo(() => {
    if (!s || !user) return [];
    return s.bookings
      .filter((b: any) => b.clientId === user.id && b.status === 'booked')
      .map((b: any) => ({ b, k: s.classes.find((c: any) => c.id === b.classId) }))
      .filter((x: any) => x.k && !x.k.cancelled && startsAt(x.k.date, x.k.end) > now)
      .sort((a: any, z: any) => (a.k.date + a.k.start).localeCompare(z.k.date + z.k.start));
  }, [s, user]);

  const running = useMemo(() => (s && user ? rules.packagesOf(s, user.id, now) : []), [s, user]);

  useEffect(() => {
    if (!s) return;
    scheduleReminders(upcoming.map((x: any) => ({
      id: x.k.id, startsAt: startsAt(x.k.date, x.k.start), time: x.k.start,
      title: t(rules.typeOf(s, x.k.typeId).name)
    })));
  }, [upcoming, lang]);

  if (loading) return <Loading />;
  if (!s) return <Screen><ErrorNote text={error} /><Button label="Try again" onPress={reload} /></Screen>;

  const cancel = (b: any, k: any) => confirm(
    t('Cancel this class?'), t('%s at %s. Cancelled in time, the class goes back to your package.', longDate(k.date, lang, true), k.start),
    t('Cancel class'), t('Keep it'),
    async () => {
      setBusy(b.id); setNote(null);
      try { await post('/api/client/cancel', { bookingId: b.id }); await reload(); }
      catch (e: any) { setNote(e.message); }
      finally { setBusy(null); }
    });

  const first = (user?.name || '').split(' ')[0];
  const who = (id: string | null) => { const i = s.instructors.find((x: any) => x.id === id); return i ? i.name.split(' ')[0] : null; };

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Title sub={t('The hour you chose.')}>{t('Hello, %s', first)}</Title>
      <ErrorNote text={note || error} />

      <Eyebrow>Your next classes</Eyebrow>
      {!upcoming.length ? (
        <Card tone="sand">
          <Body>{running.length ? t('Nothing booked yet. Pick a class that suits your week.') : t('Choose a package first, then book your classes here.')}</Body>
          <View style={{ height: 10 }} />
          <Button label={running.length ? 'Book a class' : 'See the packages'} onPress={() => router.push(running.length ? '/client/book' : '/client/packages')} />
        </Card>
      ) : upcoming.map(({ b, k }: any) => {
        const cc = rules.canCancel(k, now, s);
        return (
          <ClassCard key={b.id} k={k} typeName={rules.typeOf(s, k.typeId).name} who={who(k.instructorId)} showDate
            note={!cc.ok ? <Text style={[st.muted, { marginTop: 4 }]}>{t('Too late to cancel — it counts as used.')}</Text> : null}>
            {cc.ok ? <Button small kind="secondary" label="Cancel class" busy={busy === b.id} onPress={() => cancel(b, k)} /> : null}
          </ClassCard>
        );
      })}

      <Eyebrow>Your packages</Eyebrow>
      {!running.length ? <Empty text="No active package." /> : running.map((m: any) => {
        const lines = rules.creditLines(s, m);
        return (
          <Card key={m.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[st.h2, { marginBottom: 0, flex: 1 }]}>{m.title}</Text>
              <Pill label="Active" tone="good" />
            </Row>
            <Text style={[st.muted, { marginBottom: 8 }]}>{t('Valid until %s', longDate(m.end, lang))}</Text>
            {lines.map((l: any) => (
              <View key={l.index} style={{ marginTop: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={st.body}>{l.label}</Text>
                  <Text style={[st.body, { fontWeight: '600' }]}>
                    {l.unlimited ? t('Unlimited') : t('%s of %s left', l.left, l.total)}</Text>
                </Row>
                {!l.unlimited && l.total ? (
                  <View style={{ height: 6, backgroundColor: C.sand, borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                    <View style={{ height: 6, width: `${Math.min(100, (l.used / l.total) * 100)}%`, backgroundColor: C.wine }} />
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}
