import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { ClassRow } from '@/components/ClassRow';
import { DateStrip } from '@/components/DateStrip';
import { Chip, EmptyState, ErrorState, Gap, IconButton, Row, Screen, Segmented, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { SPA_ENABLED } from '@/lib/features';
import { addDays, lek, partOfDay, todayISO } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { photo } from '@/lib/images';
import { loc, type SessionDto, type Treatment } from '@/lib/types';
import { colors, radius, space } from '@/theme';

export default function Book() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'pilates' | 'spa'>(SPA_ENABLED && params.tab === 'spa' ? 'spa' : 'pilates');
  // Home's Pilates / SPA tiles switch the tab even when this screen is already mounted.
  const [seenParam, setSeenParam] = useState(params.tab);
  if (params.tab !== seenParam) {
    setSeenParam(params.tab);
    if ((SPA_ENABLED && params.tab === 'spa') || params.tab === 'pilates') setTab(params.tab);
  }
  const { t } = useT();
  return (
    <Screen scroll={false}>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.md }}>
        <Text variant="title">{tab === 'pilates' ? t('pilates') : t('spa')}</Text>
      </Row>
      <Gap h={space.md} />
      {SPA_ENABLED ? (
        <>
          <Segmented options={[{ value: 'pilates', label: t('pilates') }, { value: 'spa', label: t('spa') }]} value={tab} onChange={setTab} />
          <Gap h={space.md} />
        </>
      ) : null}
      {tab === 'pilates' ? <PilatesTimetable /> : <SpaCatalogue />}
    </Screen>
  );
}

function PilatesTimetable() {
  const router = useRouter();
  const { t } = useT();
  const [date, setDate] = useState(todayISO());
  const [showFilters, setShowFilters] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  // Ticks each minute so finished classes drop off and the running one is marked while the screen is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const weekStart = date;
  const q = useQuery({
    queryKey: ['sessions', weekStart],
    queryFn: () => api<SessionDto[]>('GET', `/sessions?from=${weekStart}&to=${weekStart}`),
  });
  // Clients don't filter by instructor or level, and class-type (format) chips are off for now.
  // Classes that have already ended today are not shown; the one running stays, marked "in progress".
  const list = useMemo(
    () => (q.data ?? []).filter((s) => Date.parse(s.endsAt) > now && (!onlyAvailable || s.available > 0 || s.myBookingId)),
    [q.data, onlyAvailable, now],
  );
  const groups = (['morning', 'afternoon'] as const).map((p) => ({ p, items: list.filter((s) => partOfDay(s.startsAt) === p) })).filter((g) => g.items.length);
  const filtersOn = onlyAvailable;

  return (
    <View style={{ flex: 1 }}>
      <DateStrip value={date} onChange={setDate} maxDate={addDays(todayISO(), 30)} marks />
      <Gap h={space.md} />
      <Row style={{ justifyContent: 'flex-end' }}>
        <IconButton name="sliders" label={t('filters')} badge={filtersOn ? 1 : undefined} onPress={() => setShowFilters((v) => !v)} />
      </Row>
      {showFilters ? (
        <View style={styles.filters}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Chip label={t('onlyAvailable')} active={onlyAvailable} onPress={() => setOnlyAvailable((v) => !v)} />
          </Row>
        </View>
      ) : null}
      <Gap h={space.md} />
      <View style={{ flex: 1 }}>
        {q.isPending ? (
          <SkeletonList count={5} />
        ) : q.isError && !q.data ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : groups.length === 0 ? (
          <EmptyState icon="calendar" title={t('noClasses')} body={t('noClassesSub')} />
        ) : (
          <SessionGroups groups={groups} now={now} onOpen={(id) => router.push({ pathname: '/client/class/[id]', params: { id } })} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />
        )}
      </View>
    </View>
  );
}

function SessionGroups({ groups, now, onOpen, refreshing, onRefresh }: { groups: { p: 'morning' | 'afternoon'; items: SessionDto[] }[]; now: number; onOpen: (id: string) => void; refreshing: boolean; onRefresh: () => void }) {
  const { t } = useT();
  const rows = groups.flatMap((g) => [{ kind: 'h' as const, key: g.p, p: g.p }, ...g.items.map((s) => ({ kind: 's' as const, key: s.id, s }))]);
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.wine} />}
      contentContainerStyle={{ paddingBottom: 40 }}
      renderItem={({ item }) =>
        item.kind === 'h' ? (
          <Text variant="heading" style={{ marginTop: space.sm, marginBottom: space.sm }}>{t(item.p)}</Text>
        ) : (
          <ClassRow s={item.s} now={now} onPress={() => onOpen(item.s.id)} />
        )
      }
    />
  );
}

const CATEGORIES = ['ALL', 'RELAX', 'DEEP_TISSUE', 'LYMPHATIC', 'SPORTS', 'MADERO', 'BACK_NECK'];
const catLabel: Record<string, [string, string]> = {
  RELAX: ['Relaks', 'Relax'],
  DEEP_TISSUE: ['Deep tissue', 'Deep tissue'],
  LYMPHATIC: ['Limfatik', 'Lymph'],
  SPORTS: ['Sportiv', 'Sports'],
  MADERO: ['Madero', 'Madero'],
  BACK_NECK: ['Shpinë & qafë', 'Back & neck'],
};

function SpaCatalogue() {
  const router = useRouter();
  const { t, lang } = useT();
  const [cat, setCat] = useState('ALL');
  const q = useQuery({ queryKey: ['treatments'], queryFn: () => api<Treatment[]>('GET', '/spa/treatments') });
  const present = new Set((q.data ?? []).map((x) => x.category));
  const list = (q.data ?? []).filter((x) => cat === 'ALL' || x.category === cat);
  return (
    <View style={{ flex: 1 }}>
      <Segmented
        options={CATEGORIES.filter((c) => c === 'ALL' || present.has(c)).map((c) => ({ value: c, label: c === 'ALL' ? t('all') : (catLabel[c]?.[lang === 'sq' ? 0 : 1] ?? c) }))}
        value={cat}
        onChange={setCat}
      />
      <Gap h={space.md} />
      {q.isPending ? (
        <SkeletonList count={4} height={88} />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.wine} />}
          ListEmptyComponent={<EmptyState icon="feather" title={t('noSlots')} />}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/client/treatment/[id]', params: { id: item.id } })} style={styles.treatment}>
              <Image source={photo(item.imageKey, 'massage-hands')} style={styles.tImg} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text variant="heading">{loc(lang, item.name, item.nameEn)}</Text>
                <Text variant="small">{t('min', { n: item.durationMin })}</Text>
                <Text variant="bodyMedium" style={{ marginTop: 2 }}>{lek(item.price)}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, marginTop: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  treatment: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  tImg: { width: 72, height: 56, borderRadius: radius.sm },
});
