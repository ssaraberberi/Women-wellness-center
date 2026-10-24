import Feather from '@expo/vector-icons/Feather';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Button, Card, Chip, Field, Gap, Header, Notice, Row, Screen, Section, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useT } from '@/lib/i18n';
import { colors, space } from '@/theme';

interface Hours {
  therapistHours: { id: string; weekday: number; startTime: string; endTime: string; breakStart: string | null; breakEnd: string | null }[];
  preferences: { weekday: number; startTime: string; endTime: string; note: string | null }[];
  weeklyClasses: { id: string; weekday: number; startTime: string; durationMin: number; title: string }[];
}
type Pref = { weekday: number; startTime: string; endTime: string };

const DAYS = { sq: ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

/** What the studio set, and what she would prefer — the admin reads the second, and decides. */
export default function StaffHours() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['staff-hours'], queryFn: () => api<Hours>('GET', '/staff/hours') });
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [seeded, setSeeded] = useState<Hours | undefined>(undefined);
  if (q.data && seeded !== q.data) {
    setSeeded(q.data);
    setPrefs(q.data.preferences.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })));
  }
  const save = useMutation({
    mutationFn: () => api('PUT', '/staff/availability-preferences', { body: { slots: prefs } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-hours'] });
      Alert.alert(t('saved'));
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const d = DAYS[lang];

  return (
    <Screen>
      <Header title={t('myHours')} back />
      {q.isPending || !q.data ? (
        <SkeletonList count={4} />
      ) : (
        <>
          {q.data.weeklyClasses.length ? (
            <Section title={t('weeklyClasses')}>
              {q.data.weeklyClasses.map((c) => (
                <Text key={c.id} variant="bodyMedium" style={{ paddingVertical: 4 }}>
                  {d[c.weekday - 1]} {c.startTime} · {c.title}
                </Text>
              ))}
            </Section>
          ) : null}
          {q.data.therapistHours.length ? (
            <Section title={t('myHours')}>
              {q.data.therapistHours.map((h) => (
                <Text key={h.id} variant="bodyMedium" style={{ paddingVertical: 4 }}>
                  {d[h.weekday - 1]} {h.startTime}–{h.endTime}
                  {h.breakStart ? ` · ${t('break')} ${h.breakStart}–${h.breakEnd}` : ''}
                </Text>
              ))}
            </Section>
          ) : null}
          <Section title={t('AVAILABILITY_CHANGE')}>
            <Notice text={t('adminOnlyDesk')} />
            <Gap h={space.md} />
            {prefs.map((p, i) => (
              <Row key={i} style={{ paddingVertical: 6 }}>
                <Text variant="bodyMedium" style={{ flex: 1 }}>{d[p.weekday - 1]} {p.startTime}–{p.endTime}</Text>
                <Pressable accessibilityLabel="remove" onPress={() => setPrefs(prefs.filter((_, j) => j !== i))} hitSlop={10}>
                  <Feather name="x" size={18} color={colors.danger} />
                </Pressable>
              </Row>
            ))}
            <Card style={{ marginTop: space.md }}>
              <Row style={{ flexWrap: 'wrap' }}>
                {d.map((name, i) => (
                  <Chip key={name} label={name} active={day === i + 1} onPress={() => setDay(i + 1)} />
                ))}
              </Row>
              <Gap h={space.sm} />
              <Row>
                <Field value={start} onChangeText={setStart} placeholder="09:00" style={{ width: 100 }} />
                <Text variant="body">–</Text>
                <Field value={end} onChangeText={setEnd} placeholder="17:00" style={{ width: 100 }} />
                <Button small variant="secondary" icon="plus" title="" onPress={() => hhmm.test(start) && hhmm.test(end) && end > start && setPrefs([...prefs, { weekday: day, startTime: start, endTime: end }])} style={{ marginBottom: space.md }} />
              </Row>
            </Card>
            <Gap h={space.md} />
            <Button title={t('save')} onPress={() => save.mutate()} loading={save.isPending} />
          </Section>
        </>
      )}
    </Screen>
  );
}
