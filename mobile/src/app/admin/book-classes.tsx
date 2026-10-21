/* Booking classes into one package by hand: only the classes the package
   covers — its dates, its kinds — with room left. Several at once. */
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as rules from '@shared/rules.js';
import { post } from '@/lib/api';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { longDate, startsAt } from '@/lib/format';
import { Button, Empty, ErrorNote, Loading, Row, Screen, st } from '@/components/ui';
import { C, R } from '@/lib/theme';

export default function BookClasses() {
  const { membership, reservation } = useLocalSearchParams<{ membership: string; reservation: string }>();
  const { t, lang } = useT();
  const { data: s, loading, error } = useData<any>('/api/admin/state');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);

  const m = s?.memberships.find((x: any) => x.id === membership);
  const groups = useMemo(() => {
    if (!s || !m) return [];
    const kinds = new Set((m.lines || []).flatMap((l: any) => l.types));
    const now = new Date();
    const list = s.classes.filter((k: any) => !k.cancelled && kinds.has(k.typeId) && k.date >= m.start && k.date <= m.end &&
      startsAt(k.date, k.start) > now && !s.bookings.some((b: any) => b.classId === k.id && b.clientId === m.clientId && b.status === 'booked'))
      .sort((a: any, z: any) => (a.date + a.start).localeCompare(z.date + z.start));
    const out: { date: string; items: any[] }[] = [];
    for (const k of list) { const g = out[out.length - 1]; if (g && g.date === k.date) g.items.push(k); else out.push({ date: k.date, items: [k] }); }
    return out;
  }, [s, m]);

  if (loading) return <Loading />;
  if (!s || !m) return <Screen><ErrorNote text={error || 'No such membership'} /></Screen>;

  const go = async () => {
    setBusy(true); setFail(null);
    try {
      await post('/api/admin/bookings', { membershipId: m.id, classIds: picked });
      router.back();
    } catch (e: any) { setFail(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Text style={[st.muted, { marginBottom: 8 }]}>{m.title} · {t('%s – %s', longDate(m.start, lang), longDate(m.end, lang))}</Text>
      <ErrorNote text={fail} />
      {!groups.length ? <Empty text="No classes this package can be booked into." /> : groups.map(g => (
        <View key={g.date}>
          <Text style={st.eyebrow}>{longDate(g.date, lang).toUpperCase()}</Text>
          <Row style={{ flexWrap: 'wrap' }}>
            {g.items.map((k: any) => {
              const on = picked.includes(k.id);
              const left = rules.spots(s, k).left;
              return (
                <Pressable key={k.id} disabled={!left && !on}
                  onPress={() => setPicked(p => on ? p.filter(x => x !== k.id) : [...p, k.id])}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.control, borderWidth: 1,
                           borderColor: on ? C.wine : C.line, backgroundColor: on ? C.wine : C.white, opacity: left || on ? 1 : 0.4 }}>
                  <Text style={{ color: on ? C.cream : C.ink, fontWeight: '600' }}>{k.start}</Text>
                  <Text style={{ color: on ? C.cream : C.muted, fontSize: 12 }}>{rules.typeOf(s, k.typeId).short} · {left ? t('%s left', left) : t('Full')}</Text>
                </Pressable>
              );
            })}
          </Row>
        </View>
      ))}
      <View style={{ height: 16 }} />
      <Button label={picked.length === 1 ? 'Book 1 class' : 'Book %s classes'} args={[picked.length]} onPress={go} busy={busy} disabled={!picked.length} />
    </Screen>
  );
}
