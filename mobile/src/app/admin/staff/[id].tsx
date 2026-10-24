import Feather from '@expo/vector-icons/Feather';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Badge, Button, Card, Chip, ErrorState, Field, Gap, Header, Row, Screen, Section, SkeletonList, Text, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { whenShort } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import type { Treatment } from '@/lib/types';
import { colors, space } from '@/theme';

interface Hour { weekday: number; startTime: string; endTime: string; breakStart: string | null; breakEnd: string | null }
interface Detail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  isOwner: boolean;
  staff: {
    isInstructor: boolean;
    isTherapist: boolean;
    active: boolean;
    bio: string | null;
    compensationModel: 'FIXED_SALARY' | 'HOURLY' | 'PER_CLASS';
    compensationRate: number;
    canViewClientNotes: boolean;
    therapistAvailability: Hour[];
    staffAvailability: { weekday: number; startTime: string; endTime: string }[];
    qualifications: { treatmentId: string }[];
    sessions: { id: string; startsAt: string; classType: { name: string }; _count: { bookings: number } }[];
    appointments: { id: string; startsAt: string; treatment: { name: string } }[];
  } | null;
  attendance: { status: string; _count: number }[];
}

const DAYS = { sq: ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function AdminStaffMember() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { t, lang, tEnum } = useT();
  const amOwner = useAuth((s) => !!s.me?.isOwner);
  const q = useQuery({ queryKey: ['admin-staff', id], queryFn: () => api<Detail>('GET', `/admin/staff/${id}`) });
  const treatments = useQuery({ queryKey: ['admin-treatments'], queryFn: () => api<Treatment[]>('GET', '/admin/spa/treatments') });
  const s = q.data;
  const [flags, setFlags] = useState({ isInstructor: false, isTherapist: false, canViewClientNotes: false, bio: '', compensationModel: 'PER_CLASS' as 'FIXED_SALARY' | 'HOURLY' | 'PER_CLASS', compensationRate: '0' });
  const [quals, setQuals] = useState<string[]>([]);
  const [hours, setHours] = useState<Hour[]>([]);
  const [day, setDay] = useState(1);
  const [range, setRange] = useState({ start: '10:00', end: '18:00', bs: '', be: '' });

  const [seeded, setSeeded] = useState<Detail | undefined>(undefined);
  if (s?.staff && seeded !== s) {
    setSeeded(s);
    setFlags({
      isInstructor: s.staff.isInstructor,
      isTherapist: s.staff.isTherapist,
      canViewClientNotes: s.staff.canViewClientNotes,
      bio: s.staff.bio ?? '',
      compensationModel: s.staff.compensationModel,
      compensationRate: String(s.staff.compensationRate),
    });
    setQuals(s.staff.qualifications.map((x) => x.treatmentId));
    setHours(s.staff.therapistAvailability.map(({ weekday, startTime, endTime, breakStart, breakEnd }) => ({ weekday, startTime, endTime, breakStart, breakEnd })));
  }

  const run = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-staff'] });
      Alert.alert(t('saved'));
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });

  if (q.isPending) return <Screen><Header title="" back /><SkeletonList count={5} /></Screen>;
  if (!s) return <Screen><Header title="" back /><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Screen>;
  const d = DAYS[lang];

  return (
    <Screen>
      <Header title={s.name} back subtitle={`${s.email}${s.phone ? ` · ${s.phone}` : ''}`} />
      <Row style={{ flexWrap: 'wrap' }}>
        <Badge label={tEnum(s.status)} tone={s.status === 'ACTIVE' ? 'success' : 'warning'} />
        {s.isOwner ? <Badge label={t('owner')} tone="wine" /> : null}
        {s.attendance.map((a) => <Badge key={a.status} label={`${tEnum(a.status)} ${a._count}`} />)}
      </Row>

      <Section title={t('settings')}>
        <ToggleRow label={t('isInstructor')} value={flags.isInstructor} onChange={(v) => setFlags({ ...flags, isInstructor: v })} />
        <ToggleRow label={t('isTherapist')} value={flags.isTherapist} onChange={(v) => setFlags({ ...flags, isTherapist: v })} />
        <ToggleRow label={t('canViewClientNotes')} value={flags.canViewClientNotes} onChange={(v) => setFlags({ ...flags, canViewClientNotes: v })} />
        <Gap h={space.md} />
        <Text variant="label">{t('compensation')}</Text>
        <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
          {(['PER_CLASS', 'HOURLY', 'FIXED_SALARY'] as const).map((m) => (
            <Chip key={m} label={t(m)} active={flags.compensationModel === m} onPress={() => setFlags({ ...flags, compensationModel: m })} />
          ))}
        </Row>
        <Field label={t('rate')} value={flags.compensationRate} onChangeText={(v) => setFlags({ ...flags, compensationRate: v.replace(/\D/g, '') })} keyboardType="number-pad" />
        <Field label="Bio" value={flags.bio} onChangeText={(v) => setFlags({ ...flags, bio: v })} multiline />
        <Button
          title={t('save')}
          loading={run.isPending}
          onPress={() =>
            run.mutate(() =>
              api('PATCH', `/admin/staff/${id}`, {
                body: { isInstructor: flags.isInstructor, isTherapist: flags.isTherapist, canViewClientNotes: flags.canViewClientNotes, bio: flags.bio || null, compensationModel: flags.compensationModel, compensationRate: Number(flags.compensationRate || 0) },
              }),
            )
          }
        />
      </Section>

      {flags.isTherapist ? (
        <>
          <Section title={t('qualifications')}>
            <Row style={{ flexWrap: 'wrap' }}>
              {(treatments.data ?? []).map((tr) => (
                <Chip key={tr.id} label={`${tr.name} ${tr.durationMin}'`} active={quals.includes(tr.id)} onPress={() => setQuals(quals.includes(tr.id) ? quals.filter((x) => x !== tr.id) : [...quals, tr.id])} />
              ))}
            </Row>
            <Gap h={space.sm} />
            <Button variant="secondary" title={t('save')} onPress={() => run.mutate(() => api('PUT', `/admin/staff/${id}/qualifications`, { body: { treatmentIds: quals } }))} />
          </Section>
          <Section title={t('workingHours')}>
            {hours.map((h, i) => (
              <Row key={i} style={{ paddingVertical: 6 }}>
                <Text variant="bodyMedium" style={{ flex: 1 }}>
                  {d[h.weekday - 1]} {h.startTime}–{h.endTime}{h.breakStart ? ` · ${t('break')} ${h.breakStart}–${h.breakEnd}` : ''}
                </Text>
                <Pressable onPress={() => setHours(hours.filter((_, j) => j !== i))} hitSlop={10} accessibilityLabel={t('remove')}>
                  <Feather name="x" size={18} color={colors.danger} />
                </Pressable>
              </Row>
            ))}
            <Card style={{ marginTop: space.sm }}>
              <Row style={{ flexWrap: 'wrap' }}>
                {d.map((n, i) => <Chip key={n} label={n} active={day === i + 1} onPress={() => setDay(i + 1)} />)}
              </Row>
              <Gap h={space.sm} />
              <Row>
                <Field value={range.start} onChangeText={(v) => setRange({ ...range, start: v })} placeholder="10:00" style={{ width: 80 }} />
                <Field value={range.end} onChangeText={(v) => setRange({ ...range, end: v })} placeholder="18:00" style={{ width: 80 }} />
                <Field value={range.bs} onChangeText={(v) => setRange({ ...range, bs: v })} placeholder={t('break')} style={{ width: 80 }} />
                <Field value={range.be} onChangeText={(v) => setRange({ ...range, be: v })} placeholder="—" style={{ width: 70 }} />
              </Row>
              <Button
                small
                variant="secondary"
                icon="plus"
                title={t('addSlot')}
                onPress={() => {
                  if (!hhmm.test(range.start) || !hhmm.test(range.end) || range.end <= range.start) return;
                  const brk = hhmm.test(range.bs) && hhmm.test(range.be) && range.be > range.bs;
                  setHours([...hours, { weekday: day, startTime: range.start, endTime: range.end, breakStart: brk ? range.bs : null, breakEnd: brk ? range.be : null }]);
                }}
              />
            </Card>
            <Gap h={space.sm} />
            <Button variant="secondary" title={t('save')} onPress={() => run.mutate(() => api('PUT', `/admin/staff/${id}/hours`, { body: { hours } }))} />
          </Section>
        </>
      ) : null}

      {s.staff?.staffAvailability.length ? (
        <Section title={t('AVAILABILITY_CHANGE')}>
          {s.staff.staffAvailability.map((a, i) => (
            <Text key={i} variant="body">{d[a.weekday - 1]} {a.startTime}–{a.endTime}</Text>
          ))}
        </Section>
      ) : null}

      <Section title={t('upcoming')}>
        {[...(s.staff?.sessions ?? []).map((x) => ({ id: x.id, at: x.startsAt, label: `${x.classType.name} · ${x._count.bookings}` })), ...(s.staff?.appointments ?? []).map((x) => ({ id: x.id, at: x.startsAt, label: `SPA · ${x.treatment.name}` }))]
          .sort((a, b) => a.at.localeCompare(b.at))
          .slice(0, 15)
          .map((x) => (
            <Text key={x.id} variant="body" style={{ paddingVertical: 3 }}>{whenShort(x.at, lang)} · {x.label}</Text>
          ))}
      </Section>

      <Section title={t('settings')}>
        <Row style={{ flexWrap: 'wrap' }}>
          <Button
            small
            variant="danger"
            title={s.status === 'DISABLED' ? t('activate') : t('deactivate')}
            onPress={() => run.mutate(() => api('PATCH', `/admin/staff/${id}`, { body: { active: s.status === 'DISABLED' } }).then(() => q.refetch()))}
          />
          {amOwner && s.role === 'ADMIN' ? (
            <Button small variant="secondary" title={s.isOwner ? `− ${t('owner')}` : `+ ${t('owner')}`} onPress={() => run.mutate(() => api('PATCH', `/admin/staff/${id}`, { body: { isOwner: !s.isOwner } }).then(() => q.refetch()))} />
          ) : null}
        </Row>
      </Section>
    </Screen>
  );
}
