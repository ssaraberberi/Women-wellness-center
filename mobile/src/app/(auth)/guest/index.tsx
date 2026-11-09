import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { ClassRow } from '@/components/ClassRow';
import { DateStrip } from '@/components/DateStrip';
import { EmptyState, ErrorState, Gap, Header, Notice, Screen, SkeletonList } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, lek, todayISO } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { PublicSession, SessionDto } from '@/lib/types';
import { colors, space } from '@/theme';

/** The timetable for someone not signed in: the same classes and places, no account needed to look or to book. */
export default function GuestTimetable() {
  const router = useRouter();
  const { t } = useT();
  const [date, setDate] = useState(todayISO());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const q = useQuery({
    queryKey: ['public-sessions', date],
    queryFn: () => api<{ singlePrice: number | null; sessions: PublicSession[] }>('GET', `/public/sessions?from=${date}&to=${date}`, { auth: false }),
  });
  const list = useMemo(() => (q.data?.sessions ?? []).filter((s) => s.status === 'SCHEDULED' && Date.parse(s.endsAt) > now), [q.data, now]);

  return (
    <Screen scroll={false}>
      <Header title={t('bookWithoutAccount')} back />
      <DateStrip value={date} onChange={setDate} maxDate={addDays(todayISO(), 30)} />
      <Gap h={space.md} />
      {q.data?.singlePrice ? <Notice icon="tag" text={t('guestPrice', { price: lek(q.data.singlePrice) })} /> : null}
      {q.data && q.data.singlePrice === null ? <Notice icon="alert-circle" tone="warning" text={t('onlineOff')} /> : null}
      <Gap h={space.md} />
      <View style={{ flex: 1 }}>
        {q.isPending ? (
          <SkeletonList count={5} />
        ) : q.isError && !q.data ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !list.length ? (
          <EmptyState icon="calendar" title={t('noClasses')} body={t('noClassesSub')} />
        ) : (
          <FlatList
            data={list}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.wine} />}
            renderItem={({ item }) => (
              <ClassRow
                s={{ ...item, myBookingId: null, myWaitlist: null } as SessionDto}
                now={now}
                onPress={() => (q.data?.singlePrice && item.available > 0 && Date.parse(item.startsAt) > now ? router.push({ pathname: '/guest/[id]', params: { id: item.id } }) : undefined)}
              />
            )}
          />
        )}
      </View>
    </Screen>
  );
}
