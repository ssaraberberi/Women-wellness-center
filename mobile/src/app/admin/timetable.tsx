import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { ClassTypesEditor } from '@/components/ClassTypesEditor';
import { Button, Card, Chip, Field, Gap, Header, Notice, Row, Screen, Section, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { todayISO } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { space } from '@/theme';

interface Template {
  id: string;
  classTypeId: string;
  instructorId: string | null;
  instructorName: string | null;
  weekday: number;
  startTime: string;
  durationMin: number;
  capacity: number;
  validFrom: string;
  validUntil: string | null;
  active: boolean;
  classType: { name: string };
}

const DAYS = { sq: ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };

/**
 * The weekly timetable. Each slot generates dated classes ahead; changing a
 * slot regenerates the classes nobody has booked yet. Booked ones keep their shape.
 */
export default function Timetable() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['admin-templates'], queryFn: () => api<Template[]>('GET', '/admin/templates') });
  const types = useQuery({ queryKey: ['admin-class-types'], queryFn: () => api<{ id: string; name: string; durationMin: number; defaultCapacity: number; active: boolean }[]>('GET', '/admin/class-types') });
  const instructors = useQuery({ queryKey: ['instructors'], queryFn: () => api<{ id: string; name: string }[]>('GET', '/instructors') });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ classTypeId: '', instructorId: '', weekday: 1, startTime: '18:00', capacity: '', durationMin: '' });
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-templates'] });
      void qc.invalidateQueries({ queryKey: ['admin-sessions'] });
      setOpen(false);
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const ct = types.data?.find((x) => x.id === f.classTypeId);
  const create = () =>
    run.mutate(() =>
      api('POST', '/admin/templates', {
        body: {
          classTypeId: f.classTypeId,
          instructorId: f.instructorId || null,
          weekday: f.weekday,
          startTime: f.startTime,
          durationMin: Number(f.durationMin || ct?.durationMin || 50),
          capacity: Number(f.capacity || ct?.defaultCapacity || 8),
          validFrom: todayISO(),
        },
      }),
    );
  const d = DAYS[lang];

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('timetable')} back right={<Button small icon="plus" title={t('addSlot')} onPress={() => setOpen((v) => !v)} />} />
      <Notice text={lang === 'sq' ? 'Klasat me rezervime nuk zhvendosen kurrë nga ndryshimet e orarit.' : 'Classes with bookings are never moved by timetable changes.'} />
      {open ? (
        <Card style={{ marginTop: space.md }}>
          <Text variant="label">{t('classType')}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {(types.data ?? []).filter((x) => x.active).map((x) => <Chip key={x.id} label={x.name} active={f.classTypeId === x.id} onPress={() => setF({ ...f, classTypeId: x.id })} />)}
          </Row>
          <Text variant="label">{t('instructor')}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {(instructors.data ?? []).map((i) => <Chip key={i.id} label={i.name} active={f.instructorId === i.id} onPress={() => setF({ ...f, instructorId: i.id })} />)}
          </Row>
          <Text variant="label">{t('weekday')}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {d.map((n, i) => <Chip key={n} label={n} active={f.weekday === i + 1} onPress={() => setF({ ...f, weekday: i + 1 })} />)}
          </Row>
          <Row>
            <Field label="HH:mm" value={f.startTime} onChangeText={(v) => setF({ ...f, startTime: v })} style={{ width: 90 }} />
            <Field label={t('capacity')} value={f.capacity} onChangeText={(v) => setF({ ...f, capacity: v.replace(/\D/g, '') })} placeholder={String(ct?.defaultCapacity ?? '')} keyboardType="number-pad" style={{ width: 90 }} />
            <Field label="min" value={f.durationMin} onChangeText={(v) => setF({ ...f, durationMin: v.replace(/\D/g, '') })} placeholder={String(ct?.durationMin ?? '')} keyboardType="number-pad" style={{ width: 80 }} />
          </Row>
          <Button title={t('create')} onPress={create} loading={run.isPending} disabled={!f.classTypeId || !/^\d\d:\d\d$/.test(f.startTime)} />
        </Card>
      ) : null}
      {q.isPending ? (
        <SkeletonList count={6} height={56} />
      ) : (
        d.map((dayName, i) => {
          const rows = (q.data ?? []).filter((x) => x.weekday === i + 1 && x.active);
          return rows.length ? (
            <Section key={dayName} title={dayName}>
              {rows.map((x) => (
                <Row key={x.id} style={{ paddingVertical: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{x.startTime} · {x.classType.name}</Text>
                    <Text variant="small">{x.instructorName ?? '—'} · {x.capacity} · {x.durationMin} min</Text>
                  </View>
                  <Button
                    small
                    variant="danger"
                    title={t('remove')}
                    onPress={() =>
                      Alert.alert(t('remove'), `${dayName} ${x.startTime} ${x.classType.name}`, [
                        { text: t('keep'), style: 'cancel' },
                        { text: t('remove'), style: 'destructive', onPress: () => run.mutate(() => api('DELETE', `/admin/templates/${x.id}`)) },
                      ])
                    }
                  />
                </Row>
              ))}
            </Section>
          ) : null;
        })
      )}
      <Section title={t('classType')}>
        <ClassTypesEditor />
      </Section>
      <Gap h={space.xl} />
    </Screen>
  );
}
