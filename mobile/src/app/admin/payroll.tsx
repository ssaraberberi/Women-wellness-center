import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Card, ErrorState, Gap, Header, Notice, Row, Screen, Segmented, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, lek, todayISO } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { space } from '@/theme';

interface Line { id: string; name: string; model: 'FIXED_SALARY' | 'HOURLY' | 'PER_CLASS'; rate: number; classes: number; appointments: number; hours: number; estimate: number }

/** An estimate from sessions taught and appointments completed. Nothing here pays anyone. */
export default function Payroll() {
  const { t } = useT();
  const [range, setRange] = useState<'month' | 'last30'>('month');
  const today = todayISO();
  const from = range === 'month' ? `${today.slice(0, 8)}01` : addDays(today, -29);
  const q = useQuery({ queryKey: ['admin-payroll', from, today], queryFn: () => api<Line[]>('GET', `/admin/payroll?from=${from}&to=${today}`) });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('payroll')} back />
      <Segmented options={[{ value: 'month', label: t('month') }, { value: 'last30', label: `30 ${t('days')}` }]} value={range} onChange={setRange} />
      <Gap h={space.md} />
      <Notice text={t('estimate')} />
      <Gap h={space.md} />
      {q.isPending ? (
        <SkeletonList count={4} />
      ) : !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          {q.data.map((l) => (
            <Card key={l.id} style={{ marginBottom: space.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="heading">{l.name}</Text>
                  <Text variant="small">{t(l.model)} · {lek(l.rate)}</Text>
                  <Text variant="small">{t('sessionsN', { n: l.classes })} · {l.appointments} SPA · {l.hours} {t('hours')}</Text>
                </View>
                <Text variant="title" style={{ fontSize: 20 }}>{lek(l.estimate)}</Text>
              </Row>
            </Card>
          ))}
          <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
            <Text variant="heading">{t('total')}</Text>
            <Text variant="title">{lek(q.data.reduce((s, l) => s + l.estimate, 0))}</Text>
          </Row>
        </>
      )}
    </Screen>
  );
}
