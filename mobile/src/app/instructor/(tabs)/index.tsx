/* The classes she leads, today first, with how many are coming. */
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { todayIn } from '@shared/domain.js';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { longDate, startsAt } from '@/lib/format';
import { Button, Empty, ErrorNote, Loading, Screen, Segmented, st } from '@/components/ui';
import { ClassCard } from '@/components/ClassCard';

export default function InstructorClasses() {
  const { t, lang } = useT();
  const { data: s, error, loading, refreshing, reload } = useData<any>('/api/instructor/state');
  const [when, setWhen] = useState<'next' | 'past'>('next');
  const now = new Date();
  const today = todayIn(now);

  const groups = useMemo(() => {
    if (!s) return [];
    const list = s.classes
      .filter((k: any) => when === 'next' ? startsAt(k.date, k.end) > now : startsAt(k.date, k.end) <= now)
      .sort((a: any, z: any) => (a.date + a.start).localeCompare(z.date + z.start) * (when === 'next' ? 1 : -1));
    const out: { date: string; items: any[] }[] = [];
    for (const k of list) {
      const g = out[out.length - 1];
      if (g && g.date === k.date) g.items.push(k); else out.push({ date: k.date, items: [k] });
    }
    return out;
  }, [s, when]);

  if (loading) return <Loading />;
  if (!s) return <Screen><ErrorNote text={error} /><Button label="Try again" onPress={reload} /></Screen>;
  const typeName = (id: string) => (s.classTypes.find((x: any) => x.id === id) || { name: id }).name;
  const booked = (id: string) => s.bookings.filter((b: any) => b.classId === id && b.status === 'booked').length;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Segmented value={when} onChange={setWhen} options={[{ value: 'next', label: 'Coming up' }, { value: 'past', label: 'Past' }]} />
      <ErrorNote text={error} />
      {!groups.length ? <Empty text={when === 'next' ? 'No classes assigned to you yet.' : 'Nothing in the last two weeks.'} /> : groups.map(g => (
        <View key={g.date} style={{ marginBottom: 4 }}>
          <Text style={st.eyebrow}>{((g.date === today ? t('Today') + ' · ' : '') + longDate(g.date, lang)).toUpperCase()}</Text>
          {g.items.map((k: any) => (
            <ClassCard key={k.id} k={k} typeName={typeName(k.typeId)}
              places={{ left: Math.max(0, k.capacity - booked(k.id) - (k.blocked || 0)), capacity: k.capacity }}
              note={<Text style={[st.muted, { marginTop: 2 }]}>{t('%s booked', booked(k.id))}</Text>}
              onPress={() => router.push({ pathname: '/instructor/class/[id]', params: { id: k.id } })} />
          ))}
        </View>
      ))}
    </Screen>
  );
}
