import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { ClientPicker, type ClientLite } from '@/components/ClientPicker';
import { DateStrip } from '@/components/DateStrip';
import { Badge, Button, Chip, EmptyState, Field, Gap, Header, Row, Screen, Section, SkeletonList, Text } from '@/components/ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { todayISO } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import type { Slot, Treatment } from '@/lib/types';
import { colors, radius, space } from '@/theme';

/** Book a SPA appointment for a client at the desk or over the phone. */
export default function AdminNewSpa() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const [client, setClient] = useState<ClientLite | null>(null);
  const [treatmentId, setTreatment] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState<Slot | null>(null);
  const [therapistId, setTherapist] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const treatments = useQuery({ queryKey: ['treatments'], queryFn: () => api<Treatment[]>('GET', '/spa/treatments') });
  const slots = useQuery({
    queryKey: ['slots', treatmentId, date, 'admin'],
    queryFn: () => api<Slot[]>('GET', `/spa/availability?treatmentId=${treatmentId}&date=${date}`),
    enabled: !!treatmentId,
  });
  const book = useMutation({
    mutationFn: () =>
      api('POST', '/admin/spa/appointments', {
        body: { clientId: client!.id, treatmentId, startsAt: slot!.startsAt, ...(therapistId ? { therapistId } : {}), ...(notes.trim() ? { serviceNotes: notes.trim() } : {}) },
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-appts'] });
      router.back();
    },
    onError: (e) => {
      Alert.alert('DUA', errorText(e, lang));
      setSlot(null);
      void slots.refetch();
    },
  });

  return (
    <Screen footer={<Button title={t('confirmSpa')} onPress={() => book.mutate()} disabled={!client || !slot} loading={book.isPending} />}>
      <Header title={t('newAppointment')} back />
      <Section title={t('client')}>
        {client ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="bodyMedium">{client.name}</Text>
            <Button small variant="ghost" title={t('edit')} onPress={() => setClient(null)} />
          </Row>
        ) : (
          <ClientPicker onPick={setClient} />
        )}
      </Section>
      <Section title={t('treatments')}>
        <Row style={{ flexWrap: 'wrap' }}>
          {(treatments.data ?? []).map((x) => (
            <Chip key={x.id} label={`${x.name} ${x.durationMin}'`} active={treatmentId === x.id} onPress={() => { setTreatment(x.id); setSlot(null); }} />
          ))}
        </Row>
      </Section>
      {treatmentId ? (
        <Section title={t('chooseTime')}>
          <DateStrip value={date} onChange={(d) => { setDate(d); setSlot(null); }} />
          <Gap h={space.md} />
          {slots.isPending ? (
            <SkeletonList count={2} height={44} />
          ) : !slots.data?.length ? (
            <EmptyState icon="moon" title={t('noSlots')} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {slots.data.map((s) => (
                <Pressable
                  key={s.startsAt}
                  onPress={() => { setSlot(s); setTherapist(null); }}
                  style={{ width: '23%', minHeight: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: slot?.startsAt === s.startsAt ? colors.wine : colors.line, backgroundColor: slot?.startsAt === s.startsAt ? colors.wine : colors.surface }}
                >
                  <Text variant="bodyMedium" style={slot?.startsAt === s.startsAt ? { color: colors.white } : undefined}>{s.time}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {slot && slot.therapists.length > 1 ? (
            <>
              <Gap h={space.md} />
              <Text variant="label">{t('therapist')}</Text>
              <Row style={{ flexWrap: 'wrap', marginTop: space.sm }}>
                {slot.therapists.map((th) => (
                  <Chip key={th.id} label={th.name} active={therapistId === th.id} onPress={() => setTherapist(th.id)} />
                ))}
              </Row>
            </>
          ) : slot ? (
            <Badge label={slot.therapists[0]?.name ?? ''} />
          ) : null}
        </Section>
      ) : null}
      <Gap h={space.md} />
      <Field label={t('serviceNotes')} value={notes} onChangeText={setNotes} multiline />
    </Screen>
  );
}
