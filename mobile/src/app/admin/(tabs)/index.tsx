/* The desk's day: every class on the chosen date, how full it is, who
   leads it, and a flag on anything that needs a hand. */
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import * as rules from '@shared/rules.js';
import { todayIn, plusDays } from '@shared/domain.js';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { longDate } from '@/lib/format';
import { Button, Empty, ErrorNote, Loading, Screen, st } from '@/components/ui';
import { ClassCard } from '@/components/ClassCard';
import { DayStrip } from '@/components/DayStrip';
import { C } from '@/lib/theme';

export default function AdminDay() {
  const { t, lang } = useT();
  const { data: s, error, loading, refreshing, reload } = useData<any>('/api/admin/state');
  const today = todayIn(new Date());
  const days = useMemo(() => {
    if (!s) return [];
    const ahead = Math.max(s.settings.horizonDays, 30);
    return Array.from({ length: ahead + 8 }, (_, i) => plusDays(today, i - 7));
  }, [s]);
  const [day, setDay] = useState(today);

  if (loading) return <Loading />;
  if (!s) return <Screen><ErrorNote text={error} /><Button label="Try again" onPress={reload} /></Screen>;

  const closed = (s.closures || []).find((c: any) => c.date === day);
  const list = s.classes.filter((k: any) => k.date === day).sort((a: any, z: any) => a.start.localeCompare(z.start));
  const issueOf = (id: string) => (s.issues || []).filter((i: any) => i.klass && i.klass.id === id);
  const name = (id: string | null) => { const i = s.instructors.find((x: any) => x.id === id); return i ? i.name : null; };
  const busyDays = new Set<string>(s.bookings.filter((b: any) => b.status === 'booked')
    .map((b: any) => (s.classes.find((k: any) => k.id === b.classId) || {}).date).filter(Boolean));

  return (
    <Screen refreshing={refreshing} onRefresh={reload} padded={false}>
      <View style={{ height: 12 }} />
      <DayStrip days={days} value={day} onChange={setDay} marks={busyDays} />
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={st.h2}>{day === today ? t('Today') + ' · ' + longDate(day, lang) : longDate(day, lang, true)}</Text>
        {closed ? <Text style={{ color: C.bad, marginBottom: 8 }}>{t('The studio is closed this day.')}{closed.reason ? ' ' + closed.reason : ''}</Text> : null}
        {day < s.settings.openingDate ? <Text style={[st.muted, { marginBottom: 8 }]}>{t('Before the opening date (%s).', longDate(s.settings.openingDate, lang))}</Text> : null}
        <ErrorNote text={error} />
        {!list.length ? <Empty text="No classes on this day." /> : list.map((k: any) => {
          const sp = rules.spots(s, k);
          const flags = issueOf(k.id);
          return (
            <ClassCard key={k.id} k={k} typeName={rules.typeOf(s, k.typeId).name} who={name(k.instructorId)}
              places={{ left: sp.left, capacity: k.capacity }}
              note={<>
                <Text style={[st.muted, { marginTop: 2 }]}>{t('%s booked', sp.taken)}{sp.blocked ? ' · ' + t('%s blocked', sp.blocked) : ''}</Text>
                {flags.map((f: any, i: number) => (
                  <Text key={i} style={{ color: C.warn, marginTop: 2, fontWeight: '600' }}>
                    {f.kind === 'unassigned' ? t('Nobody assigned') : f.kind === 'overfull' ? t('Overbooked') :
                     f.kind === 'outside-package' ? t('A booking is outside its package dates') : t(f.why || f.kind)}</Text>
                ))}
              </>}
              onPress={() => router.push({ pathname: '/admin/class/[id]', params: { id: k.id } })} />
          );
        })}
      </View>
    </Screen>
  );
}
