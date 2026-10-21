/* Her week: the hours she can take classes, and what she is qualified
   for. The studio only places her inside these, so keeping them true is
   what keeps her schedule right. */
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { put } from '@/lib/api';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { Button, Card, ErrorNote, Eyebrow, Loading, Row, Screen, st } from '@/components/ui';
import { C, R } from '@/lib/theme';

type Band = { from: string; to: string };
const DAYS: [string, string][] = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
                                  ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function Availability() {
  const { t } = useT();
  const { data: s, loading, error, reload } = useData<any>('/api/instructor/state');
  const [week, setWeek] = useState<Record<string, Band[]>>({});
  const [quals, setQuals] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!s?.me) return;
    setWeek(JSON.parse(JSON.stringify(s.me.availability || {})));
    setQuals(s.me.qualifications || []);
  }, [s]);

  if (loading) return <Loading />;
  if (!s) return <Screen><ErrorNote text={error} /><Button label="Try again" onPress={reload} /></Screen>;

  const edit = (day: string, i: number, k: keyof Band, v: string) =>
    setWeek(w => ({ ...w, [day]: (w[day] || []).map((b, j) => j === i ? { ...b, [k]: v } : b) }));
  const add = (day: string) => setWeek(w => ({ ...w, [day]: [...(w[day] || []), { from: '09:00', to: '17:00' }] }));
  const drop = (day: string, i: number) => setWeek(w => ({ ...w, [day]: (w[day] || []).filter((_, j) => j !== i) }));

  const save = async () => {
    for (const [day] of DAYS) for (const b of week[day] || [])
      if (!HHMM.test(b.from) || !HHMM.test(b.to) || b.from >= b.to)
        return setNote({ ok: false, text: t('Times are written as 09:00, and each band ends after it starts.') });
    if (!quals.length) return setNote({ ok: false, text: t('Pick at least one kind of class they can take') });
    setBusy(true); setNote(null);
    try {
      await put('/api/instructor/availability', { availability: week });
      await put('/api/instructor/qualifications', { types: quals });
      setNote({ ok: true, text: t('Saved. The studio sees your new hours.') });
    } catch (e: any) { setNote({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  const time = (day: string, i: number, k: keyof Band, v: string) => (
    <TextInput value={v} onChangeText={x => edit(day, i, k, x)} keyboardType="numbers-and-punctuation" maxLength={5}
      style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.control, paddingHorizontal: 10, minHeight: 42,
               width: 76, fontSize: 16, color: C.ink, backgroundColor: C.white, textAlign: 'center' }} />
  );

  return (
    <Screen>
      <Eyebrow>What you teach</Eyebrow>
      <Row style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        {s.classTypes.map((c: any) => {
          const on = quals.includes(c.id);
          return (
            <Pressable key={c.id} onPress={() => setQuals(q => on ? q.filter(x => x !== c.id) : [...q, c.id])}
              style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1,
                       borderColor: on ? C.wine : C.line, backgroundColor: on ? C.wine : C.white }}>
              <Text style={{ color: on ? C.cream : C.ink, fontWeight: '600' }}>{t(c.name)}</Text>
            </Pressable>
          );
        })}
      </Row>

      <Eyebrow>Your hours</Eyebrow>
      {DAYS.map(([day, label]) => (
        <Card key={day}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[st.body, { fontWeight: '600' }]}>{t(label)}</Text>
            <Pressable onPress={() => add(day)} hitSlop={8}><Text style={{ color: C.wine, fontWeight: '600' }}>{t('+ Add hours')}</Text></Pressable>
          </Row>
          {!(week[day] || []).length ? <Text style={[st.muted, { marginTop: 6 }]}>{t('Not available')}</Text> : null}
          {(week[day] || []).map((b, i) => (
            <Row key={i} style={{ marginTop: 8 }}>
              {time(day, i, 'from', b.from)}
              <Text style={st.muted}>–</Text>
              {time(day, i, 'to', b.to)}
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => drop(day, i)} hitSlop={8} accessibilityLabel={t('Remove')}>
                <Ionicons name="close-circle-outline" size={24} color={C.muted} />
              </Pressable>
            </Row>
          ))}
        </Card>
      ))}
      {note ? <Text style={{ color: note.ok ? C.good : C.bad, marginVertical: 8 }}>{note.text}</Text> : null}
      <Button label="Save changes" onPress={save} busy={busy} />
    </Screen>
  );
}
