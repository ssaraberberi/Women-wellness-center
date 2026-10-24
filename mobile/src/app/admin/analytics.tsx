import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { ErrorState, Gap, Header, Row, Screen, Section, Segmented, SkeletonList, Stat, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, lek, todayISO } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, space } from '@/theme';

interface A {
  revenue: { gross: number; refunds: number; net: number; byDay: { day: string; amount: number }[] };
  membershipSales: { name: string; count: number; revenue: number }[];
  occupancy: { sessions: number; capacity: number; booked: number; rate: number };
  popularTimes: { weekday: number; hour: number; booked: number }[];
  popularInstructors: { name: string; booked: number; sessions: number }[];
  spa: { byStatus: { status: string; count: number }[]; popularTreatments: { name: string; count: number; revenue: number }[] };
  cancellations: { total: number; cancelled: number; late: number; byStudio: number; rate: number };
  clients: { new: number; active: number; returning: number; firstTimeInPeriod: number; retentionRate: number | null };
  creditUsage: Record<string, number>;
}

const DAYS = { sq: ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Numbers straight from the database. A bar is a share of the largest value in its list. */
function Bars({ rows }: { rows: { label: string; value: number; display: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View>
      {rows.map((r) => (
        <View key={r.label} style={{ marginBottom: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" style={{ color: colors.ink }}>{r.label}</Text>
            <Text variant="small">{r.display}</Text>
          </Row>
          <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.sand, marginTop: 4 }}>
            <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.wine, width: `${(r.value / max) * 100}%` }} />
          </View>
        </View>
      ))}
      {!rows.length ? <Text variant="small">—</Text> : null}
    </View>
  );
}

export default function AdminAnalytics() {
  const { t, lang, tEnum } = useT();
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const to = todayISO();
  const from = addDays(to, -Number(range) + 1);
  const q = useQuery({ queryKey: ['admin-analytics', range], queryFn: () => api<A>('GET', `/admin/analytics?from=${from}&to=${to}`) });
  const a = q.data;
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('analytics')} back />
      <Segmented options={[{ value: '7', label: `7 ${t('days')}` }, { value: '30', label: `30 ${t('days')}` }, { value: '90', label: `90 ${t('days')}` }]} value={range} onChange={setRange} />
      <Gap h={space.md} />
      {q.isPending ? (
        <SkeletonList count={5} height={90} />
      ) : !a ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            <Stat label={t('net')} value={lek(a.revenue.net)} sub={`${t('gross')} ${lek(a.revenue.gross)}`} />
            <Stat label={t('occupancy')} value={pct(a.occupancy.rate)} sub={`${a.occupancy.booked}/${a.occupancy.capacity}`} />
            <Stat label={t('cancellations')} value={pct(a.cancellations.rate)} sub={`${a.cancellations.late} late`} />
            <Stat label={t('retention')} value={a.clients.retentionRate === null ? '—' : pct(a.clients.retentionRate)} sub={`${t('returning')} ${a.clients.returning}`} />
            <Stat label={t('newClients')} value={a.clients.new} />
            <Stat label={t('activeMembers')} value={a.clients.active} sub={`${a.clients.firstTimeInPeriod} new in period`} />
          </View>
          <Section title={t('revenue')}>
            <Bars rows={a.revenue.byDay.map((d) => ({ label: d.day.slice(5), value: d.amount, display: lek(d.amount) }))} />
          </Section>
          <Section title={t('membershipSales')}>
            <Bars rows={a.membershipSales.map((s) => ({ label: s.name, value: s.count, display: `${s.count} · ${lek(s.revenue)}` }))} />
          </Section>
          <Section title={t('popularTimes')}>
            <Bars rows={a.popularTimes.map((p) => ({ label: `${DAYS[lang][p.weekday - 1]} ${String(p.hour).padStart(2, '0')}:00`, value: p.booked, display: String(p.booked) }))} />
          </Section>
          <Section title={t('popularInstructors')}>
            <Bars rows={a.popularInstructors.map((p) => ({ label: p.name, value: p.booked, display: `${p.booked} · ${t('sessionsN', { n: p.sessions })}` }))} />
          </Section>
          <Section title={t('popularTreatments')}>
            <Bars rows={a.spa.popularTreatments.map((p) => ({ label: p.name, value: p.count, display: `${p.count} · ${lek(p.revenue)}` }))} />
            <Row style={{ flexWrap: 'wrap', marginTop: space.sm }}>
              {a.spa.byStatus.map((s) => <Text key={s.status} variant="small">{tEnum(s.status)}: {s.count}   </Text>)}
            </Row>
          </Section>
          <Section title={t('creditUsage')}>
            {Object.entries(a.creditUsage).map(([k, v]) => (
              <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
                <Text variant="body">{tEnum(k)}</Text>
                <Text variant="bodyMedium">{v > 0 ? `+${v}` : v}</Text>
              </Row>
            ))}
          </Section>
        </>
      )}
    </Screen>
  );
}
