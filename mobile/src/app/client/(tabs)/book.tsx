/* The timetable, day by day, with the one answer that matters on each
   class: can I book it, and if not, why. The answer comes from
   shared/rules.js — the same code the server runs before it writes. */
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import * as rules from '@shared/rules.js';
import { todayIn, plusDays } from '@shared/domain.js';
import { post } from '@/lib/api';
import { useData } from '@/lib/useData';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { longDate, startsAt } from '@/lib/format';
import { Button, Empty, ErrorNote, Loading, Screen, Segmented, confirm, st } from '@/components/ui';
import { ClassCard } from '@/components/ClassCard';
import { DayStrip } from '@/components/DayStrip';
import { C } from '@/lib/theme';

export default function Book() {
  const { user } = useSession();
  const { t, lang } = useT();
  const { data: s, error, loading, refreshing, reload } = useData<any>('/api/client/state');
  const now = new Date();
  const today = todayIn(now);

  const days = useMemo(() => {
    if (!s) return [];
    const first = today > s.settings.openingDate ? today : s.settings.openingDate;
    return Array.from({ length: s.settings.horizonDays + 1 }, (_, i) => plusDays(first, i));
  }, [s]);
  const [day, setDay] = useState<string | null>(null);
  const [type, setType] = useState<string>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const mine = useMemo(() => new Set<string>((s?.bookings || [])
    .filter((b: any) => b.clientId === user?.id && b.status === 'booked')
    .map((b: any) => (s.classes.find((c: any) => c.id === b.classId) || {}).date).filter(Boolean)), [s]);

  if (loading) return <Loading />;
  if (!s) return <Screen><ErrorNote text={error} /><Button label="Try again" onPress={reload} /></Screen>;

  const current = day && days.includes(day) ? day : days[0];
  const list = s.classes
    .filter((k: any) => k.date === current && !k.cancelled && (type === 'all' || k.typeId === type) && startsAt(k.date, k.start) > now)
    .sort((a: any, z: any) => a.start.localeCompare(z.start));
  const who = (id: string | null) => { const i = s.instructors.find((x: any) => x.id === id); return i ? i.name.split(' ')[0] : null; };
  const hasPackage = rules.packagesOf(s, user!.id, now).length > 0;

  const book = (k: any) => confirm(
    t('Book this class?'), t('%s at %s. You can cancel up to %s minutes before.', longDate(k.date, lang, true), k.start, s.settings.cancelMinutes),
    t('Book'), t('Not now'),
    async () => {
      setBusy(k.id); setNote(null);
      try { await post('/api/client/book', { classId: k.id }); await reload(); }
      catch (e: any) { setNote(e.message); await reload(); }
      finally { setBusy(null); }
    }, false);

  const cancel = (b: any, k: any) => confirm(
    t('Cancel this class?'), t('%s at %s. Cancelled in time, the class goes back to your package.', longDate(k.date, lang, true), k.start),
    t('Cancel class'), t('Keep it'),
    async () => {
      setBusy(k.id); setNote(null);
      try { await post('/api/client/cancel', { bookingId: b.id }); await reload(); }
      catch (e: any) { setNote(e.message); }
      finally { setBusy(null); }
    });

  return (
    <Screen refreshing={refreshing} onRefresh={reload} padded={false}>
      <View style={{ height: 12 }} />
      <DayStrip days={days} value={current} onChange={setDay} marks={mine} />
      <View style={{ paddingHorizontal: 16 }}>
        {s.classTypes.length > 1 ? (
          <Segmented value={type} onChange={setType}
            options={[{ value: 'all', label: 'All' }, ...s.classTypes.map((c: any) => ({ value: c.id, label: c.short }))]} />
        ) : null}
        <Text style={[st.h2, { marginTop: 4 }]}>{longDate(current, lang, true)}</Text>
        <ErrorNote text={note || error} />
        {!hasPackage ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={st.muted}>{t('To book, you need a package. Reserve one and pay at the studio.')}</Text>
            <Button small kind="secondary" label="See the packages" onPress={() => router.push('/client/packages')} />
          </View>
        ) : null}
        {current < s.settings.openingDate ? <Empty text="Classes start when the studio opens" /> : null}
        {!list.length ? <Empty text="No classes on this day." /> : list.map((k: any) => {
          const sp = rules.spots(s, k);
          const mineB = rules.bookingOf(s, user!.id, k.id);
          const verdict = rules.canBook(s, user!.id, k, now);
          const cc = rules.canCancel(k, now, s);
          return (
            <ClassCard key={k.id} k={k} typeName={rules.typeOf(s, k.typeId).name} who={who(k.instructorId)}
              places={{ left: sp.left, capacity: k.capacity }}
              note={mineB ? <Text style={{ color: C.good, fontWeight: '600', marginTop: 4 }}>{t('You are booked')}</Text>
                : !verdict.ok && verdict.code !== 'full' && hasPackage ? <Text style={[st.muted, { marginTop: 4 }]}>{t((verdict as any).message)}</Text> : null}>
              {mineB
                ? cc.ok ? <Button small kind="secondary" label="Cancel class" busy={busy === k.id} onPress={() => cancel(mineB, k)} /> : null
                : verdict.ok ? <Button small label="Book" busy={busy === k.id} onPress={() => book(k)} /> : null}
            </ClassCard>
          );
        })}
      </View>
    </Screen>
  );
}
