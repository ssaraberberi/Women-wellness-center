import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { ClassRow } from '@/components/ClassRow';
import { DateStrip } from '@/components/DateStrip';
import { Chip, EmptyState, ErrorState, Gap, IconButton, Row, Screen, Segmented, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, lek, partOfDay, todayISO } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { photo } from '@/lib/images';
import { loc, type Difficulty, type SessionDto, type Treatment } from '@/lib/types';
import { colors, radius, space } from '@/theme';

export default function Book() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'pilates' | 'spa'>(params.tab === 'spa' ? 'spa' : 'pilates');
  // Home's Pilates / SPA tiles switch the tab even when this screen is already mounted.
  const [seenParam, setSeenParam] = useState(params.tab);
  if (params.tab !== seenParam) {
    setSeenParam(params.tab);
    if (params.tab === 'spa' || params.tab === 'pilates') setTab(params.tab);
  }
  const { t } = useT();
  return (
    <Screen scroll={false}>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.md }}>
        <Text variant="title">{tab === 'pilates' ? t('pilates') : t('spa')}</Text>
      </Row>
      <Gap h={space.md} />
      <Segmented options={[{ value: 'pilates', label: t('pilates') }, { value: 'spa', label: t('spa') }]} value={tab} onChange={setTab} />
      <Gap h={space.md} />
      {tab === 'pilates' ? <PilatesTimetable /> : <SpaCatalogue />}
    </Screen>
  );
}

function PilatesTimetable() {
  const router = useRouter();
  const { t } = useT();
  const [date, setDate] = useState(todayISO());
  const [format, setFormat] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const weekStart = date;
  const q = useQuery({
    queryKey: ['sessions', weekStart],
    queryFn: () => api<SessionDto[]>('GET', `/sessions?from=${weekStart}&to=${weekStart}`),
  });
  const instructors = useQuery({ queryKey: ['instructors'], queryFn: () => api<{ id: string; name: string }[]>('GET', '/instructors'), staleTime: 3600_000 });

  const list = useMemo(
    () =>
      (q.data ?? []).filter(
        (s) =>
          (format === 'ALL' || s.classType.format === format) &&
          (!instructorId || s.instructor?.id === instructorId) &&
          (!difficulty || s.classType.difficulty === difficulty) &&
          (!onlyAvailable || s.available > 0 || s.myBookingId),
      ),
    [q.data, format, instructorId, difficulty, onlyAvailable],
  );
  const formats = useMemo(() => [...new Set((q.data ?? []).map((s) => s.classType.format))], [q.data]);
  const groups = (['morning', 'afternoon'] as const).map((p) => ({ p, items: list.filter((s) => partOfDay(s.startsAt) === p) })).filter((g) => g.items.length);
  const filtersOn = !!instructorId || !!difficulty || onlyAvailable;

  return (
    <View style={{ flex: 1 }}>
      <DateStrip value={date} onChange={setDate} maxDate={addDays(todayISO(), 30)} />
      <Gap h={space.md} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={space.sm} style={{ flex: 1, flexWrap: 'wrap' }}>
          <Chip label={t('all')} active={format === 'ALL'} onPress={() => setFormat('ALL')} />
          {formats.map((f) => (
            <Chip key={f} label={f.charAt(0) + f.slice(1).toLowerCase()} active={format === f} onPress={() => setFormat(f)} />
          ))}
        </Row>
        <IconButton name="sliders" label={t('filters')} badge={filtersOn ? 1 : undefined} onPress={() => setShowFilters((v) => !v)} />
      </Row>
      {showFilters ? (
        <View style={styles.filters}>
          <Text variant="label">{t('instructor')}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {(instructors.data ?? []).map((i) => (
              <Chip key={i.id} label={i.name} active={instructorId === i.id} onPress={() => setInstructorId(instructorId === i.id ? null : i.id)} />
            ))}
          </Row>
          <Text variant="label">{t('level')}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'] as const).map((d) => (
              <Chip key={d} label={t(d)} active={difficulty === d} onPress={() => setDifficulty(difficulty === d ? null : d)} />
            ))}
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Chip label={t('onlyAvailable')} active={onlyAvailable} onPress={() => setOnlyAvailable((v) => !v)} />
            {filtersOn ? <Chip label={t('clear')} onPress={() => { setInstructorId(null); setDifficulty(null); setOnlyAvailable(false); }} /> : null}
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
          <SessionGroups groups={groups} onOpen={(id) => router.push({ pathname: '/client/class/[id]', params: { id } })} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />
        )}
      </View>
    </View>
  );
}

function SessionGroups({ groups, onOpen, refreshing, onRefresh }: { groups: { p: 'morning' | 'afternoon'; items: SessionDto[] }[]; onOpen: (id: string) => void; refreshing: boolean; onRefresh: () => void }) {
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
          <ClassRow s={item.s} onPress={() => onOpen(item.s.id)} />
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
