/* Every reservation, newest first: search by name, phone or reference,
   and narrow to what needs doing — pending, or not yet paid. */
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { money, shortDate } from '@/lib/format';
import { statusLabel, statusTone } from '@/lib/catalogue';
import { Button, Card, Empty, ErrorNote, Field, Loading, Pill, Row, Screen, Segmented, st } from '@/components/ui';

type Filter = 'all' | 'pending' | 'unpaid';

export default function Reservations() {
  const { t, lang } = useT();
  const { data, error, loading, refreshing, reload } = useData<any[]>('/api/admin/reservations');
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>('all');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, '');
    return (data || []).filter(r =>
      (f === 'all' || (f === 'pending' ? r.status === 'pending' : r.payment === 'unpaid' && r.status !== 'cancelled')) &&
      (!needle || r.ref.toLowerCase().includes(needle) || r.title.toLowerCase().includes(needle) ||
        r.people.some((p: any) => (p.name || '').toLowerCase().includes(needle) ||
          (digits.length >= 3 && String(p.phone || '').replace(/\D/g, '').includes(digits)))));
  }, [data, q, f]);

  if (loading) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Button label="+ New reservation" onPress={() => router.push('/admin/new-reservation')} />
      <View style={{ height: 8 }} />
      <Field label="Search" value={q} onChangeText={setQ} placeholder={t('Name, phone or DUA-…')} autoCapitalize="none" />
      <Segmented value={f} onChange={setF} options={[{ value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'unpaid', label: 'Unpaid' }]} />
      <ErrorNote text={error} />
      {!list.length ? <Empty text="No reservations match." /> : list.slice(0, 150).map(r => (
        <Card key={r.id} onPress={() => router.push({ pathname: '/admin/reservation/[id]', params: { id: r.id } })}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[st.body, { fontWeight: '600', flex: 1 }]} numberOfLines={1}>
              {r.people.map((p: any) => p.name).join(' & ') || '—'}</Text>
            <Text style={st.muted}>{shortDate(String(r.createdAt).slice(0, 10), lang)}</Text>
          </Row>
          <Text style={st.muted} numberOfLines={1}>{r.ref} · {r.title}</Text>
          <Row style={{ marginTop: 6 }}>
            <Pill label={statusLabel(r.status)} tone={statusTone(r.status)} />
            <Pill label={r.payment === 'paid' ? 'Paid' : 'Unpaid'} tone={r.payment === 'paid' ? 'good' : 'neutral'} />
            {r.source === 'app' ? <Pill label="App" tone="wine" /> : null}
            <View style={{ flex: 1 }} />
            {r.totalPrice != null ? <Text style={st.body}>{money(r.totalPrice, lang)}</Text> : null}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
