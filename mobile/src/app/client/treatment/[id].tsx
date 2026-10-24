import Feather from '@expo/vector-icons/Feather';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateStrip } from '@/components/DateStrip';
import { Badge, Button, Chip, EmptyState, ErrorState, Gap, OfflineBanner, Row, SkeletonList, Text } from '@/components/ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { addDays, lek, longDate, time, todayISO } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { photo } from '@/lib/images';
import { loc, type Slot, type Treatment } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';

export default function TreatmentBooking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const [date, setDate] = useState(addDays(todayISO(), 1));
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const key = useRef(newIdempotencyKey());

  const tq = useQuery({ queryKey: ['treatment', id], queryFn: () => api<Treatment>('GET', `/spa/treatments/${id}`) });
  const sq = useQuery({
    queryKey: ['slots', id, date, therapistId],
    queryFn: () => api<Slot[]>('GET', `/spa/availability?treatmentId=${id}&date=${date}${therapistId ? `&therapistId=${therapistId}` : ''}`),
  });
  const memberships = useQuery({ queryKey: ['memberships'], queryFn: () => api<any>('GET', '/me/memberships') });
  const tr = tq.data;
  const covered = (memberships.data?.purchases ?? []).some(
    (p: any) => p.status === 'ACTIVE' && p.spa.some((e: any) => e.remaining > 0 && (e.name === tr?.name || e.name === tr?.category)),
  );

  const book = useMutation({
    mutationFn: () => api<any>('POST', '/spa/appointments', { body: { treatmentId: id, startsAt: slot!.startsAt, ...(therapistId ? { therapistId } : {}) }, idempotencyKey: key.current }),
    onSuccess: (appt) => {
      void qc.invalidateQueries({ queryKey: ['home'] });
      void qc.invalidateQueries({ queryKey: ['spa-appointments'] });
      void qc.invalidateQueries({ queryKey: ['memberships'] });
      router.replace({
        pathname: '/client/booked',
        params: { kind: 'spa', title: loc(lang, tr!.name, tr!.nameEn), startsAt: appt.startsAt, endsAt: appt.endsAt, subtitle: appt.paidWith === 'ENTITLEMENT' ? t('coveredByPackage') : `${t('payOnSite')} · ${lek(appt.price)}`, image: tr!.imageKey ?? 'massage-hands' },
      });
    },
    onError: (e) => {
      Alert.alert('DUA', errorText(e, lang));
      key.current = newIdempotencyKey();
      setSlot(null);
      void sq.refetch();
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Image source={photo(tr?.imageKey, 'massage-hands')} style={StyleSheet.absoluteFill} contentFit="cover" />
          <SafeAreaView edges={['top']} style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
            <Pressable accessibilityLabel={t('back')} onPress={() => router.back()} style={styles.round}>
              <Feather name="chevron-left" size={22} color={colors.ink} />
            </Pressable>
          </SafeAreaView>
        </View>
        <View style={{ padding: space.xl }}>
          {tq.isPending ? (
            <SkeletonList count={3} height={40} />
          ) : !tr ? (
            <ErrorState error={tq.error} onRetry={() => void tq.refetch()} />
          ) : (
            <>
              <Text variant="display">{loc(lang, tr.name, tr.nameEn)}</Text>
              <Row style={{ marginVertical: space.md }}>
                <Badge label={t('min', { n: tr.durationMin })} />
                <Badge label={lek(tr.price)} />
                {covered ? <Badge label={t('coveredByPackage')} tone="success" /> : null}
              </Row>
              <Text variant="body">{loc(lang, tr.description, tr.descriptionEn)}</Text>
              {tr.benefits ? (
                <>
                  <Gap h={space.md} />
                  <Text variant="label">{t('benefits').toUpperCase()}</Text>
                  <Text variant="body">{loc(lang, tr.benefits, tr.benefitsEn)}</Text>
                </>
              ) : null}

              <Gap h={space.xl} />
              <Text variant="heading" style={{ marginBottom: space.sm }}>{t('chooseDate')}</Text>
              <DateStrip value={date} onChange={(d) => { setDate(d); setSlot(null); }} maxDate={addDays(todayISO(), 30)} />

              {tr.therapists && tr.therapists.length > 1 ? (
                <>
                  <Gap h={space.lg} />
                  <Text variant="heading" style={{ marginBottom: space.sm }}>{t('therapist')}</Text>
                  <Row style={{ flexWrap: 'wrap' }}>
                    <Chip label={t('anyTherapist')} active={!therapistId} onPress={() => { setTherapistId(null); setSlot(null); }} />
                    {tr.therapists.map((th) => (
                      <Chip key={th.id} label={th.name} active={therapistId === th.id} onPress={() => { setTherapistId(th.id); setSlot(null); }} />
                    ))}
                  </Row>
                </>
              ) : null}

              <Gap h={space.lg} />
              <Text variant="heading" style={{ marginBottom: space.sm }}>{t('chooseTime')}</Text>
              {sq.isPending ? (
                <SkeletonList count={2} height={44} />
              ) : sq.isError ? (
                <ErrorState error={sq.error} onRetry={() => void sq.refetch()} />
              ) : !sq.data?.length ? (
                <EmptyState icon="moon" title={t('noSlots')} />
              ) : (
                <View style={styles.grid}>
                  {sq.data.map((s) => {
                    const on = slot?.startsAt === s.startsAt;
                    return (
                      <Pressable key={s.startsAt} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setSlot(s)} style={[styles.slot, on && styles.slotOn]}>
                        <Text variant="bodyMedium" style={[{ fontFamily: fonts.semibold }, on && { color: colors.white }]}>{s.time}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
      {tr ? (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          {slot ? (
            <Text variant="small" center style={{ marginBottom: space.sm }}>
              {longDate(slot.startsAt, lang)} · {time(slot.startsAt)} · {slot.therapists[0]?.name} · {covered ? t('coveredByPackage') : `${t('payOnSite')} ${lek(tr.price)}`}
            </Text>
          ) : null}
          <Button title={t('confirmSpa')} onPress={() => book.mutate()} disabled={!slot} loading={book.isPending} />
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 220, backgroundColor: colors.sand },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(250,246,241,0.9)', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: { width: '23%', minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  slotOn: { backgroundColor: colors.wine, borderColor: colors.wine },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.bg },
});
