import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { DateStrip } from '@/components/DateStrip';
import { Button, Chip, Field, Gap, Header, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { todayISO } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { space } from '@/theme';

/** A one-off class on one date (the weekly timetable is under More → Weekly timetable). */
export default function NewSession() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const types = useQuery({ queryKey: ['admin-class-types'], queryFn: () => api<{ id: string; name: string; defaultCapacity: number; durationMin: number; active: boolean }[]>('GET', '/admin/class-types') });
  const instructors = useQuery({ queryKey: ['instructors'], queryFn: () => api<{ id: string; name: string }[]>('GET', '/instructors') });
  const [classTypeId, setType] = useState<string | null>(null);
  const [instructorId, setInstructor] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [startTime, setStart] = useState('18:00');
  const [capacity, setCapacity] = useState('');
  const create = useMutation({
    mutationFn: () => api('POST', '/admin/sessions', { body: { classTypeId, instructorId, date, startTime, ...(capacity ? { capacity: Number(capacity) } : {}) } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-sessions'] });
      router.back();
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  return (
    <Screen footer={<Button title={t('create')} onPress={() => create.mutate()} disabled={!classTypeId || !/^\d\d:\d\d$/.test(startTime)} loading={create.isPending} />}>
      <Header title={t('newClass')} back />
      <Text variant="label">{t('classType')}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        {(types.data ?? []).filter((x) => x.active).map((x) => (
          <Chip key={x.id} label={x.name} active={classTypeId === x.id} onPress={() => setType(x.id)} />
        ))}
      </Row>
      <Text variant="label">{t('instructor')}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        {(instructors.data ?? []).map((i) => (
          <Chip key={i.id} label={i.name} active={instructorId === i.id} onPress={() => setInstructor(i.id)} />
        ))}
      </Row>
      <Gap h={space.sm} />
      <DateStrip value={date} onChange={setDate} />
      <Gap h={space.md} />
      <Field label="HH:mm" value={startTime} onChangeText={setStart} />
      <Field label={t('capacity')} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder={String(types.data?.find((x) => x.id === classTypeId)?.defaultCapacity ?? 8)} />
    </Screen>
  );
}
