import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Field, Header, Screen, Section, SkeletonList, Text, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useT, type TKey } from '@/lib/i18n';
import { space } from '@/theme';

type S = Record<string, any>;
const NUMBERS: TKey[] = ['freeCancelHours', 'bookingWindowDays', 'waitlistOfferMinutes', 'spaFreeCancelHours'];
const MORE: [string, string][] = [
  ['bookingCutoffMin', 'Booking cut-off (min before)'],
  ['defaultClassCapacity', 'Default class capacity'],
  ['spaSlotStepMin', 'SPA slot step (min)'],
  ['reminderHoursBefore', 'Reminder (hours before)'],
  ['expiryReminderDays', 'Expiry reminder (days before)'],
  ['scheduleHorizonDays', 'Generate classes (days ahead)'],
];
const BOOLS: TKey[] = ['lateCancelKeepsCredit', 'waitlistEnabled', 'activateBeforePayment'];
const DAYS = { sq: ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };

/** Every studio rule lives here, not in the app: the app only shows what the server says. */
export default function AdminSettings() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: () => api<S>('GET', '/admin/settings') });
  const [s, setS] = useState<S | null>(null);
  const [hours, setHours] = useState<Record<string, string>>({});
  const [seeded, setSeeded] = useState<S | undefined>(undefined);
  if (q.data && seeded !== q.data) {
    setSeeded(q.data);
    setS(q.data);
    const h: Record<string, string> = {};
    for (let d = 1; d <= 7; d++) {
      const v = q.data.openingHours?.[String(d)];
      h[d] = v ? `${v.open}-${v.close}` : '';
    }
    setHours(h);
  }
  const save = useMutation({
    mutationFn: () => {
      const openingHours: Record<string, { open: string; close: string } | null> = {};
      for (let d = 1; d <= 7; d++) {
        const m = (hours[d] ?? '').match(/^(\d\d:\d\d)-(\d\d:\d\d)$/);
        openingHours[String(d)] = m ? { open: m[1], close: m[2] } : null;
      }
      const body: S = { studioName: s!.studioName, address: s!.address, phone: s!.phone, instagram: s!.instagram, openingHours };
      for (const k of [...NUMBERS, ...MORE.map((m) => m[0])]) body[k] = Number(s![k]);
      for (const k of BOOLS) body[k] = !!s![k];
      return api('PATCH', '/admin/settings', { body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
      Alert.alert(t('saved'));
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const num = (k: string) => (v: string) => setS({ ...s, [k]: v.replace(/\D/g, '') });

  return (
    <Screen footer={s ? <Button title={t('save')} onPress={() => save.mutate()} loading={save.isPending} /> : undefined}>
      <Header title={t('settings')} back />
      {!s ? (
        <SkeletonList count={6} height={52} />
      ) : (
        <>
          <Section title={t('studio')}>
            <Field label={t('name')} value={s.studioName} onChangeText={(v) => setS({ ...s, studioName: v })} />
            <Field label="Adresa / Address" value={s.address} onChangeText={(v) => setS({ ...s, address: v })} />
            <Field label={t('phone')} value={s.phone} onChangeText={(v) => setS({ ...s, phone: v })} />
            <Field label="Instagram" value={s.instagram} onChangeText={(v) => setS({ ...s, instagram: v })} />
          </Section>
          <Section title="Orari / Opening hours">
            <Text variant="small" style={{ marginBottom: space.sm }}>07:00-21:00 · {lang === 'sq' ? 'bosh = mbyllur' : 'empty = closed'}</Text>
            {DAYS[lang].map((d, i) => (
              <Field key={d} label={d} value={hours[i + 1] ?? ''} onChangeText={(v) => setHours({ ...hours, [i + 1]: v })} placeholder="—" />
            ))}
          </Section>
          <Section title={t('policies')}>
            {NUMBERS.map((k) => (
              <Field key={k} label={t(k)} value={String(s[k] ?? '')} onChangeText={num(k)} keyboardType="number-pad" />
            ))}
            {MORE.map(([k, label]) => (
              <Field key={k} label={label} value={String(s[k] ?? '')} onChangeText={num(k)} keyboardType="number-pad" />
            ))}
            {BOOLS.map((k) => (
              <ToggleRow key={k} label={t(k)} value={!!s[k]} onChange={(v) => setS({ ...s, [k]: v })} />
            ))}
          </Section>
        </>
      )}
    </Screen>
  );
}
