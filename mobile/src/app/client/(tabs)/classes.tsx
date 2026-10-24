import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Badge, Button, EmptyState, ErrorState, Gap, IconButton, Row, Screen, Segmented, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { dayNum, lek, monthShort, tirane, time, whenShort } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { loc, type SessionDto } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';

type Scope = 'upcoming' | 'past' | 'cancelled' | 'waitlist';

interface BookingItem {
  id: string;
  kind: 'booking' | 'waitlist';
  status: string;
  creditsUsed?: number;
  creditRefunded?: boolean;
  attendance?: string | null;
  freeCancelUntil?: string;
  canCancel?: boolean;
  offerExpiresAt?: string | null;
  session: SessionDto;
}
interface SpaItem {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  price: number;
  paidWith: string;
  treatment: { name: string; nameEn: string | null; durationMin: number };
  therapist: string;
  room: string;
  freeCancelUntil: string;
  canCancel: boolean;
}

type ListItem = { type: 'class'; at: string; b: BookingItem } | { type: 'spa'; at: string; a: SpaItem };

export default function MyClasses() {
  const { t } = useT();
  const [scope, setScope] = useState<Scope>('upcoming');
  const router = useRouter();
  return (
    <Screen scroll={false}>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.md }}>
        <Text variant="title">{t('tabMyClasses')}</Text>
        <IconButton name="bell" label={t('notifications')} onPress={() => router.push('/client/notifications')} />
      </Row>
      <Gap h={space.md} />
      <Segmented
        options={[
          { value: 'upcoming', label: t('upcoming') },
          { value: 'past', label: t('past') },
          { value: 'cancelled', label: t('cancelled') },
          { value: 'waitlist', label: t('waitlist') },
        ]}
        value={scope}
        onChange={setScope}
      />
      <Gap h={space.md} />
      <List scope={scope} />
    </Screen>
  );
}

function List({ scope }: { scope: Scope }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const bq = useQuery({ queryKey: ['bookings', scope], queryFn: () => api<BookingItem[]>('GET', `/me/bookings?scope=${scope}`) });
  const spaScope = scope === 'upcoming' || scope === 'past' ? scope : null;
  const sq = useQuery({ queryKey: ['spa-appointments', spaScope], queryFn: () => api<SpaItem[]>('GET', `/me/spa-appointments?scope=${spaScope}`), enabled: !!spaScope });

  const cancelSpa = useMutation({
    mutationFn: (id: string) => api('POST', `/spa/appointments/${id}/cancel`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['spa-appointments'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });

  const rows: ListItem[] = [
    ...(bq.data ?? []).map((b) => ({ type: 'class' as const, at: b.session.startsAt, b })),
    ...(spaScope ? (sq.data ?? []).filter((a) => scope !== 'past' || a.status !== 'CANCELLED').map((a) => ({ type: 'spa' as const, at: a.startsAt, a })) : []),
  ].sort((x, y) => (scope === 'upcoming' || scope === 'waitlist' ? x.at.localeCompare(y.at) : y.at.localeCompare(x.at)));

  if (bq.isPending) return <SkeletonList count={4} height={84} />;
  if (bq.isError && !bq.data) return <ErrorState error={bq.error} onRetry={() => void bq.refetch()} />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => (r.type === 'class' ? r.b.id : r.a.id)}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={bq.isRefetching} onRefresh={() => { void bq.refetch(); void sq.refetch(); }} tintColor={colors.wine} />}
      ListEmptyComponent={
        <EmptyState
          icon="calendar"
          title={t('noBookings')}
          body={t('noBookingsSub')}
          action={scope === 'upcoming' ? <Button title={t('bookNow')} onPress={() => router.push('/client/book')} /> : undefined}
        />
      }
      renderItem={({ item }) => {
        if (item.type === 'class') {
          const b = item.b;
          const s = b.session;
          const right =
            b.kind === 'waitlist' ? (
              <Badge label={b.status === 'OFFERED' ? t('OFFERED') : t('WAITING')} tone={b.status === 'OFFERED' ? 'success' : 'warning'} />
            ) : scope === 'upcoming' ? (
              <Button small variant="secondary" title={t('manage')} onPress={() => router.push({ pathname: '/client/class/[id]', params: { id: s.id } })} />
            ) : scope === 'cancelled' ? (
              <Badge label={t(b.status as 'CANCELLED')} tone={b.creditRefunded ? 'neutral' : 'danger'} />
            ) : b.attendance ? (
              <Badge label={t(b.attendance as 'PRESENT')} tone={b.attendance === 'PRESENT' ? 'success' : 'danger'} />
            ) : null;
          return (
            <DateCard
              iso={s.startsAt}
              title={loc(lang, s.classType.name, s.classType.nameEn)}
              sub={`${time(s.startsAt)} · ${t('min', { n: s.durationMin })} · ${s.instructor?.name ?? ''}`}
              extra={
                scope === 'cancelled'
                  ? b.creditRefunded
                    ? t('creditRefunded')
                    : t('creditKept')
                  : scope === 'upcoming' && b.freeCancelUntil
                    ? t('freeCancelUntil', { date: whenShort(b.freeCancelUntil, lang) })
                    : undefined
              }
              right={right}
              onPress={() => router.push({ pathname: '/client/class/[id]', params: { id: s.id } })}
            />
          );
        }
        const a = item.a;
        return (
          <DateCard
            iso={a.startsAt}
            title={`SPA · ${loc(lang, a.treatment.name, a.treatment.nameEn)}`}
            sub={`${time(a.startsAt)} · ${t('min', { n: a.treatment.durationMin })} · ${a.therapist}`}
            extra={a.paidWith === 'ENTITLEMENT' ? t('coveredByPackage') : `${t('payOnSite')} · ${lek(a.price)}`}
            right={
              a.canCancel ? (
                <Button
                  small
                  variant="secondary"
                  title={t('cancel')}
                  loading={cancelSpa.isPending && cancelSpa.variables === a.id}
                  onPress={() =>
                    Alert.alert(t('cancelConfirmTitle'), new Date() <= new Date(a.freeCancelUntil) ? '' : t('cancelLate'), [
                      { text: t('keep'), style: 'cancel' },
                      { text: t('yesCancel'), style: 'destructive', onPress: () => cancelSpa.mutate(a.id) },
                    ])
                  }
                />
              ) : (
                <Badge label={t(a.status as 'COMPLETED')} />
              )
            }
          />
        );
      }}
    />
  );
}

function DateCard({ iso, title, sub, extra, right, onPress }: { iso: string; title: string; sub: string; extra?: string; right?: React.ReactNode; onPress?: () => void }) {
  const { lang } = useT();
  const d = tirane(iso).iso;
  return (
    <Pressable accessibilityRole="button" disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.date}>
        <Text variant="title" style={{ fontSize: 22, lineHeight: 26 }}>{dayNum(d)}</Text>
        <Text variant="caption">{monthShort(d, lang)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="heading" numberOfLines={1} style={{ fontFamily: fonts.semibold }}>{title}</Text>
        <Text variant="small" numberOfLines={1}>{sub}</Text>
        {extra ? <Text variant="caption" style={{ marginTop: 2 }} numberOfLines={1}>{extra}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  date: { width: 50, height: 56, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
