import Feather from '@expo/vector-icons/Feather';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, ErrorState, Gap, KeyValue, Notice, OfflineBanner, Row, SkeletonList, Text } from '@/components/ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { longDate, time, whenShort } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { photo } from '@/lib/images';
import { loc, type SessionDetail } from '@/lib/types';
import { colors, radius, space } from '@/theme';

export default function ClassDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['session', id], queryFn: () => api<SessionDetail>('GET', `/sessions/${id}`) });
  // One key per screen visit: a double tap or a retry after a timeout books once.
  const bookKey = useRef(newIdempotencyKey());

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ['session', id] });
    void qc.invalidateQueries({ queryKey: ['sessions'] });
    void qc.invalidateQueries({ queryKey: ['home'] });
    void qc.invalidateQueries({ queryKey: ['bookings'] });
    void qc.invalidateQueries({ queryKey: ['memberships'] });
  };
  const fail = (e: unknown) => {
    Alert.alert('DUA', errorText(e, lang));
    refreshAll();
  };

  const book = useMutation({
    mutationFn: () => api('POST', `/sessions/${id}/book`, { idempotencyKey: bookKey.current }),
    onSuccess: () => {
      refreshAll();
      router.replace({ pathname: '/client/booked', params: { kind: 'class', sessionId: id } });
    },
    onError: fail,
  });
  const accept = useMutation({
    mutationFn: (waitlistId: string) => api('POST', `/waitlist/${waitlistId}/accept`, { idempotencyKey: bookKey.current }),
    onSuccess: () => {
      refreshAll();
      router.replace({ pathname: '/client/booked', params: { kind: 'class', sessionId: id } });
    },
    onError: fail,
  });
  const join = useMutation({ mutationFn: () => api('POST', `/sessions/${id}/waitlist`), onSuccess: refreshAll, onError: fail });
  const leave = useMutation({ mutationFn: (wid: string) => api('DELETE', `/waitlist/${wid}`), onSuccess: refreshAll, onError: fail });
  const cancel = useMutation({
    mutationFn: (bookingId: string) => api<{ refunded: boolean }>('POST', `/bookings/${bookingId}/cancel`),
    onSuccess: (r) => {
      refreshAll();
      Alert.alert(t('CANCELLED'), r.refunded ? t('creditRefunded') : t('creditKept'));
    },
    onError: fail,
  });

  const s = q.data;
  const inTime = s ? new Date() <= new Date(s.freeCancelUntil) : true;
  const confirmCancel = () =>
    s?.myBookingId &&
    Alert.alert(t('cancelConfirmTitle'), inTime || !s.lateCancelKeepsCredit ? t('cancelInTime') : t('cancelLate'), [
      { text: t('keep'), style: 'cancel' },
      { text: t('yesCancel'), style: 'destructive', onPress: () => cancel.mutate(s.myBookingId!) },
    ]);

  let action: React.ReactNode = null;
  if (s) {
    if (s.myBookingId) {
      action = <Button variant="danger" title={t('cancelBooking')} onPress={confirmCancel} loading={cancel.isPending} disabled={new Date(s.startsAt) <= new Date()} />;
    } else if (s.myWaitlist?.status === 'OFFERED') {
      action = <Button title={t('acceptOffer')} onPress={() => accept.mutate(s.myWaitlist!.id)} loading={accept.isPending} />;
    } else if (s.myWaitlist) {
      action = <Button variant="secondary" title={t('leaveWaitlist')} onPress={() => leave.mutate(s.myWaitlist!.id)} loading={leave.isPending} />;
    } else if (!s.bookable) {
      action = <Button title={t('bookClass')} onPress={() => {}} disabled />;
    } else if (!s.eligible) {
      action = <Button title={t('seePackages')} onPress={() => router.push('/client/packages')} />;
    } else if (s.available > 0) {
      action = <Button title={t('bookClass')} onPress={() => book.mutate()} loading={book.isPending} />;
    } else if (s.waitlistEnabled) {
      action = <Button variant="secondary" title={t('joinWaitlist')} onPress={() => join.mutate()} loading={join.isPending} />;
    } else {
      action = <Button title={t('full')} onPress={() => {}} disabled />;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Image source={photo(s?.classType.imageKey)} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          <SafeAreaView edges={['top']} style={styles.heroBar}>
            <Pressable accessibilityLabel={t('back')} onPress={() => router.back()} style={styles.round}>
              <Feather name="chevron-left" size={22} color={colors.ink} />
            </Pressable>
          </SafeAreaView>
        </View>
        <View style={{ padding: space.xl }}>
          {q.isPending ? (
            <SkeletonList count={4} height={40} />
          ) : !s ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : (
            <>
              <Text variant="display">{loc(lang, s.classType.name, s.classType.nameEn)}</Text>
              <Row style={{ flexWrap: 'wrap', marginVertical: space.md }}>
                <Badge label={t(s.classType.difficulty)} />
                <Badge label={t('min', { n: s.durationMin })} />
                {s.instructor ? <Badge label={s.instructor.name} /> : null}
                {s.myBookingId ? <Badge label={t('booked')} tone="wine" /> : null}
                {s.status === 'CANCELLED' ? <Badge label={t('CANCELLED')} tone="danger" /> : null}
              </Row>
              <KeyValue icon="calendar" text={longDate(s.startsAt, lang)} />
              <KeyValue icon="clock" text={`${time(s.startsAt)} – ${time(s.endsAt)}`} />
              <KeyValue icon="map-pin" text={s.room ?? 'DUA · Komuna e Parisit'} />
              <KeyValue icon="users" text={`${t('placesLeft', { n: s.available })} · ${t('capacity')} ${s.capacity}`} />
              <Gap h={space.md} />
              <Text variant="body">{loc(lang, s.classType.description, s.classType.descriptionEn)}</Text>
              {s.instructorBio ? (
                <>
                  <Gap h={space.md} />
                  <Text variant="label">{t('instructor').toUpperCase()}</Text>
                  <Text variant="body">{s.instructorBio}</Text>
                </>
              ) : null}
              <Gap h={space.lg} />

              {s.myWaitlist?.status === 'OFFERED' && s.myWaitlist.offerExpiresAt ? (
                <Notice tone="success" icon="gift" text={`${t('offerTitle')} ${t('offerUntil', { time: time(s.myWaitlist.offerExpiresAt) })}`} />
              ) : s.myWaitlist?.position ? (
                <Notice tone="warning" icon="clock" text={t('waitlistPosition', { n: s.myWaitlist.position })} />
              ) : !s.myBookingId ? (
                <Notice tone={s.eligible ? 'wine' : 'warning'} icon="credit-card" text={s.eligible ? t('eligibleYes', { n: s.myCredits }) : t('eligibleNo')} />
              ) : null}
              <Gap h={space.sm} />
              <Notice
                tone="wine"
                icon="rotate-ccw"
                text={`${t('freeCancelUntil', { date: whenShort(s.freeCancelUntil, lang) })}. ${s.lateCancelKeepsCredit ? t('lateCancelNote') : t('lateCancelRefund')}`}
              />
            </>
          )}
        </View>
      </ScrollView>
      {s ? (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          {action}
          {!s.myBookingId && s.classType.creditsRequired ? (
            <Text variant="small" center style={{ marginTop: 6 }}>
              {t('creditCost', { n: s.classType.creditsRequired })}
            </Text>
          ) : null}
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 260, backgroundColor: colors.sand },
  heroBar: { paddingHorizontal: space.lg, paddingTop: space.sm },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(250,246,241,0.9)', alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
});
