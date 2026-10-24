import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AgendaItem, mergeAgenda, type Schedule, type StaffItem } from '@/components/AgendaItem';
import { DateStrip } from '@/components/DateStrip';
import { Badge, EmptyState, ErrorState, Gap, Header, Notice, Row, Screen, Segmented, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, dayShort, dayNum, isoWeekday, tirane, todayISO } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { space } from '@/theme';

/** Day view or the whole week, classes and appointments together. */
export default function StaffSchedule() {
  const router = useRouter();
  const { t, lang } = useT();
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const monday = addDays(date, 1 - isoWeekday(date));
  const q = useQuery({ queryKey: ['staff-schedule', monday], queryFn: () => api<Schedule>('GET', `/staff/schedule?from=${monday}&to=${addDays(monday, 6)}`) });
  const all = q.data ? mergeAgenda(q.data) : [];
  const open = (i: StaffItem) =>
    i.kind === 'class' ? router.push({ pathname: '/staff/session/[id]', params: { id: i.id } }) : router.push({ pathname: '/staff/appointment/[id]', params: { id: i.id } });
  const closed = (d: string) => q.data?.closures.find((c) => c.date === d);
  const dayItems = (d: string) => all.filter((i) => tirane(i.startsAt).iso === d);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('tabSchedule')} />
      <Segmented options={[{ value: 'day', label: t('day') }, { value: 'week', label: t('week') }]} value={mode} onChange={setMode} />
      <Gap h={space.md} />
      <DateStrip value={date} onChange={setDate} />
      <Gap h={space.lg} />
      {q.isPending ? (
        <SkeletonList count={4} />
      ) : !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : mode === 'day' ? (
        <>
          {closed(date) ? <Notice tone="warning" text={`${t('closedDay')}${closed(date)!.reason ? ` · ${closed(date)!.reason}` : ''}`} /> : null}
          {q.data.timeOff.some((o) => tirane(o.startsAt).iso <= date && tirane(o.endsAt).iso >= date) ? <Notice tone="success" text={t('TIME_OFF')} /> : null}
          <Gap h={space.sm} />
          {dayItems(date).length ? dayItems(date).map((i) => <AgendaItem key={i.id} item={i} onPress={() => open(i)} />) : <EmptyState icon="sun" title={t('nothingToday')} />}
        </>
      ) : (
        Array.from({ length: 7 }, (_, k) => addDays(monday, k)).map((d) => (
          <View key={d} style={{ marginBottom: space.md }}>
            <Row style={{ marginBottom: space.sm }}>
              <Text variant="heading">{dayShort(d, lang)} {dayNum(d)}</Text>
              {closed(d) ? <Badge label={t('closedDay')} tone="warning" /> : null}
            </Row>
            {dayItems(d).length ? dayItems(d).map((i) => <AgendaItem key={i.id} item={i} onPress={() => open(i)} />) : <Text variant="small">—</Text>}
          </View>
        ))
      )}
    </Screen>
  );
}
