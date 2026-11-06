import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { api } from '@/lib/api';
import { addDays, longDate, monthTitle, todayISO } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { EmptyState, ErrorState, Gap, Header, Row, Screen, Segmented, SkeletonList, Stat, Text } from './ui';

interface Item { id: string; date: string; start: string; end: string; className: string; instructor: string | null; participants: number; present: number; absent: number }
interface History { classes: Item[]; totals: { classes: number; participants: number; hours: number } }

const first = (iso: string) => `${iso.slice(0, 8)}01`;
const shift = (f: string, n: number) => {
  const m = +f.slice(5, 7) - 1 + n;
  const y = +f.slice(0, 4) + Math.floor(m / 12);
  return `${y}-${String((((m % 12) + 12) % 12) + 1).padStart(2, '0')}-01`;
};

/**
 * The classes that actually took place — at least one participant — a month
 * at a time, by day: "E hënë · 08:00–09:00 Reformer · 3". An instructor sees
 * her own; an admin everyone's, or one instructor's.
 */
export function ClassHistoryScreen({ admin }: { admin?: boolean }) {
  const router = useRouter();
  const { t, lang } = useT();
  const [month, setMonth] = useState(first(todayISO()));
  const [instructorId, setInstructorId] = useState<string>('all');
  const from = month;
  const to = addDays(shift(month, 1), -1);
  const instructors = useQuery({ queryKey: ['instructors'], queryFn: () => api<{ id: string; name: string }[]>('GET', '/instructors'), enabled: !!admin, staleTime: 3600_000 });
  const q = useQuery({
    queryKey: ['class-history', from, instructorId],
    queryFn: () => api<History>('GET', `/classes/history?from=${from}&to=${to}${admin && instructorId !== 'all' ? `&instructorId=${instructorId}` : ''}`),
  });
  const days = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const c of q.data?.classes ?? []) m.set(c.date, [...(m.get(c.date) ?? []), c]);
    // Newest day first, a day's classes in time order.
    return [...m.entries()].map(([date, items]) => ({ date, items: items.sort((a, b) => a.start.localeCompare(b.start)) }));
  }, [q.data]);
  const isThisMonth = month === first(todayISO());

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('classHistory')} back subtitle={t('classHistorySub')} />
      <View style={styles.monthBar}>
        <Pressable accessibilityLabel={t('back')} onPress={() => setMonth(shift(month, -1))} style={styles.arrow}>
          <Feather name="chevron-left" size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.month}>{monthTitle(month, lang)}</Text>
        <Pressable accessibilityLabel={t('next')} disabled={isThisMonth} onPress={() => setMonth(shift(month, 1))} style={[styles.arrow, isThisMonth && { opacity: 0.3 }]}>
          <Feather name="chevron-right" size={18} color={colors.ink} />
        </Pressable>
      </View>
      {admin && (instructors.data?.length ?? 0) > 1 ? (
        <>
          <Gap h={space.md} />
          <Segmented options={[{ value: 'all', label: t('allInstructors') }, ...(instructors.data ?? []).map((i) => ({ value: i.id, label: i.name }))]} value={instructorId} onChange={setInstructorId} />
        </>
      ) : null}
      <Gap h={space.md} />

      {q.isPending ? (
        <SkeletonList count={4} height={70} />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !days.length ? (
        <EmptyState icon="calendar" title={t('noHistory')} />
      ) : (
        <>
          <Row gap={space.md}>
            <Stat label={t('classesLabel')} value={q.data!.totals.classes} />
            <Stat label={t('participants')} value={q.data!.totals.participants} sub={t('hoursN', { n: q.data!.totals.hours })} />
          </Row>
          {days.map((d) => (
            <View key={d.date} style={{ marginTop: space.lg }}>
              <Text variant="eyebrow" style={{ marginBottom: space.sm }}>{longDate(d.date, lang)}</Text>
              <View style={styles.dayCard}>
                {d.items.map((c, i) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: admin ? '/admin/session/[id]' : '/staff/session/[id]', params: { id: c.id } })}
                    style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.time}>{c.start}–{c.end}</Text>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium">{c.className}</Text>
                      <Text variant="small">
                        {[admin ? c.instructor ?? '—' : null, c.present ? t('presentN', { n: c.present }) : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={styles.badge}>
                      <Feather name="users" size={12} color={colors.wine} />
                      <Text style={styles.badgeText}>{c.participants}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 6, ...shadow },
  month: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, textTransform: 'capitalize' },
  arrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  dayCard: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.lg, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  time: { width: 92, fontFamily: fonts.display, fontSize: 15, color: colors.wine },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.blush, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.wine },
});
