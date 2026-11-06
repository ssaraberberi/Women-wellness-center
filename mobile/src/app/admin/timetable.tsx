import Feather from '@expo/vector-icons/Feather';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { ClassTypesEditor } from '@/components/ClassTypesEditor';
import { Button, Card, Chip, Field, Gap, Header, Notice, Row, Screen, Section, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { todayISO } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { colors, radius, space } from '@/theme';

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
type ClassType = { id: string; name: string; durationMin: number; defaultCapacity: number; active: boolean };
// instructorId: undefined = not chosen (in bulk: leave as it is), null = no instructor.
type Form = { classTypeId: string; instructorId: string | null | undefined; weekday: number; startTime: string; capacity: string; durationMin: string };

const DAYS = { sq: ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
const blank: Form = { classTypeId: '', instructorId: undefined, weekday: 1, startTime: '18:00', capacity: '', durationMin: '' };

/**
 * The weekly timetable. Each slot generates dated classes ahead; changing a
 * slot regenerates the classes nobody has booked yet. Booked ones keep their
 * time and size, but always follow the slot's instructor.
 * Tap a slot to edit it; "Select" changes or removes many slots at once.
 */
export default function Timetable() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['admin-templates'], queryFn: () => api<Template[]>('GET', '/admin/templates') });
  const types = useQuery({ queryKey: ['admin-class-types'], queryFn: () => api<ClassType[]>('GET', '/admin/class-types') });
  const instructors = useQuery({ queryKey: ['instructors'], queryFn: () => api<{ id: string; name: string }[]>('GET', '/instructors') });

  // 'new' | 'bulk' | a template id | null
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState<Form>(blank);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-templates'] });
      void qc.invalidateQueries({ queryKey: ['admin-sessions'] });
      setEditing(null);
      setPicked([]);
      setSelecting(false);
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });

  const d = DAYS[lang];
  const ct = types.data?.find((x) => x.id === f.classTypeId);
  const rows = (q.data ?? []).filter((x) => x.active);
  const bulk = editing === 'bulk';

  const startNew = () => {
    setF(blank);
    setEditing(editing === 'new' ? null : 'new');
  };
  const startEdit = (x: Template) => {
    setF({ classTypeId: x.classTypeId, instructorId: x.instructorId, weekday: x.weekday, startTime: x.startTime, capacity: String(x.capacity), durationMin: String(x.durationMin) });
    setEditing(x.id);
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleDay = (ids: string[]) => setPicked((p) => (ids.every((id) => p.includes(id)) ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]));

  const save = () => {
    if (bulk) {
      // Only what was touched is sent: an empty field means "leave it as it is".
      const changes: Record<string, unknown> = {};
      if (f.classTypeId) changes.classTypeId = f.classTypeId;
      if (f.instructorId !== undefined) changes.instructorId = f.instructorId;
      if (f.startTime) changes.startTime = f.startTime;
      if (f.capacity) changes.capacity = Number(f.capacity);
      if (f.durationMin) changes.durationMin = Number(f.durationMin);
      run.mutate(() => api('PATCH', '/admin/templates/bulk', { body: { ids: picked, changes } }));
      return;
    }
    const body = {
      classTypeId: f.classTypeId,
      instructorId: f.instructorId ?? null,
      weekday: f.weekday,
      startTime: f.startTime,
      durationMin: Number(f.durationMin || ct?.durationMin || 50),
      capacity: Number(f.capacity || ct?.defaultCapacity || 5),
    };
    run.mutate(() => (editing === 'new' ? api('POST', '/admin/templates', { body: { ...body, validFrom: todayISO() } }) : api('PATCH', `/admin/templates/${editing}`, { body })));
  };
  const bulkRemove = () =>
    Alert.alert(t('remove'), t('selectedN', { n: picked.length }), [
      { text: t('keep'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: () => run.mutate(() => api('POST', '/admin/templates/bulk-remove', { body: { ids: picked } })) },
    ]);

  const canSave = bulk
    ? (!!f.classTypeId || f.instructorId !== undefined || !!f.startTime || !!f.capacity || !!f.durationMin) && (!f.startTime || hhmm.test(f.startTime))
    : !!f.classTypeId && hhmm.test(f.startTime);

  const form = (
    <Card style={{ marginVertical: space.md }}>
      <Text variant="heading" style={{ marginBottom: space.sm }}>
        {bulk ? t('editSelected', { n: picked.length }) : editing === 'new' ? t('addSlot') : t('editSlot')}
      </Text>
      {bulk ? <Text variant="small" style={{ marginBottom: space.sm }}>{t('bulkHint')}</Text> : null}

      <Text variant="label">{t('instructor')}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        {bulk ? <Chip label={t('noChange')} active={f.instructorId === undefined} onPress={() => setF({ ...f, instructorId: undefined })} /> : null}
        {(instructors.data ?? []).map((i) => (
          <Chip key={i.id} label={i.name} active={f.instructorId === i.id} onPress={() => setF({ ...f, instructorId: i.id })} />
        ))}
        <Chip label={t('noInstructor')} active={f.instructorId === null} onPress={() => setF({ ...f, instructorId: null })} />
      </Row>

      <Text variant="label">{t('classType')}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        {bulk ? <Chip label={t('noChange')} active={!f.classTypeId} onPress={() => setF({ ...f, classTypeId: '' })} /> : null}
        {(types.data ?? []).filter((x) => x.active).map((x) => (
          <Chip key={x.id} label={x.name} active={f.classTypeId === x.id} onPress={() => setF({ ...f, classTypeId: x.id })} />
        ))}
      </Row>

      {!bulk ? (
        <>
          <Text variant="label">{t('weekday')}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {d.map((n, i) => <Chip key={n} label={n} active={f.weekday === i + 1} onPress={() => setF({ ...f, weekday: i + 1 })} />)}
          </Row>
        </>
      ) : null}

      <Row>
        <Field label="HH:mm" value={f.startTime} onChangeText={(v) => setF({ ...f, startTime: v })} placeholder={bulk ? '—' : '18:00'} style={{ width: 90 }} />
        <Field label={t('capacity')} value={f.capacity} onChangeText={(v) => setF({ ...f, capacity: v.replace(/\D/g, '') })} placeholder={bulk ? '—' : String(ct?.defaultCapacity ?? '')} keyboardType="number-pad" style={{ width: 90 }} />
        <Field label="min" value={f.durationMin} onChangeText={(v) => setF({ ...f, durationMin: v.replace(/\D/g, '') })} placeholder={bulk ? '—' : String(ct?.durationMin ?? '')} keyboardType="number-pad" style={{ width: 80 }} />
      </Row>
      <Row>
        <Button title={editing === 'new' ? t('create') : t('save')} onPress={save} loading={run.isPending} disabled={!canSave} style={{ flex: 1 }} />
        <Button variant="ghost" title={t('cancel')} onPress={() => setEditing(null)} />
      </Row>
    </Card>
  );

  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      footer={
        selecting && !bulk ? (
          <Row>
            <Button
              title={t('editSelected', { n: picked.length })}
              disabled={!picked.length}
              onPress={() => {
                setF({ ...blank, startTime: '' });
                setEditing('bulk');
              }}
              style={{ flex: 1 }}
            />
            <Button variant="danger" title={t('remove')} disabled={!picked.length} onPress={bulkRemove} />
          </Row>
        ) : undefined
      }
    >
      <Header
        title={t('timetable')}
        back
        right={
          <Row>
            <Button
              small
              variant="secondary"
              title={selecting ? t('cancel') : t('select')}
              onPress={() => {
                setSelecting((v) => !v);
                setPicked([]);
                setEditing(null);
              }}
            />
            {!selecting ? <Button small icon="plus" title={t('addSlot')} onPress={startNew} /> : null}
          </Row>
        }
      />
      <Notice text={lang === 'sq' ? 'Klasat me rezervime ruajnë orën dhe vendet; instruktorja ndryshon edhe tek ato.' : 'Booked classes keep their time and places; the instructor changes on them too.'} />
      {editing === 'new' || bulk ? form : null}

      {q.isPending ? (
        <SkeletonList count={6} height={56} />
      ) : (
        d.map((dayName, i) => {
          const day = rows.filter((x) => x.weekday === i + 1);
          if (!day.length) return null;
          const ids = day.map((x) => x.id);
          const allPicked = ids.every((id) => picked.includes(id));
          return (
            <Section key={dayName} title={dayName} action={selecting ? <Chip label={t('all')} active={allPicked} onPress={() => toggleDay(ids)} /> : undefined}>
              {day.map((x) => {
                const on = picked.includes(x.id);
                return (
                  <View key={x.id}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={selecting ? { selected: on } : undefined}
                      onPress={() => (selecting ? toggle(x.id) : editing === x.id ? setEditing(null) : startEdit(x))}
                      style={({ pressed }) => [
                        { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.md, marginBottom: 4 },
                        on && { backgroundColor: colors.blush },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      {selecting ? (
                        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? colors.wine : colors.oat, backgroundColor: on ? colors.wine : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {on ? <Feather name="check" size={13} color={colors.white} /> : null}
                        </View>
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium">{x.startTime} · {x.classType.name}</Text>
                        <Text variant="small" style={!x.instructorName ? { color: colors.warning } : undefined}>
                          {x.instructorName ?? t('noInstructor')} · {t('spots', { n: x.capacity })} · {x.durationMin} min
                        </Text>
                      </View>
                      {!selecting ? <Feather name={editing === x.id ? 'chevron-up' : 'edit-2'} size={16} color={colors.muted} /> : null}
                    </Pressable>
                    {editing === x.id ? (
                      <>
                        {form}
                        <Button
                          small
                          variant="danger"
                          title={t('remove')}
                          style={{ marginBottom: space.md }}
                          onPress={() =>
                            Alert.alert(t('remove'), `${dayName} ${x.startTime} ${x.classType.name}`, [
                              { text: t('keep'), style: 'cancel' },
                              { text: t('remove'), style: 'destructive', onPress: () => run.mutate(() => api('DELETE', `/admin/templates/${x.id}`)) },
                            ])
                          }
                        />
                      </>
                    ) : null}
                  </View>
                );
              })}
            </Section>
          );
        })
      )}
      <Section title={t('classType')}>
        <ClassTypesEditor />
      </Section>
      <Gap h={space.xl} />
    </Screen>
  );
}
