/* One reservation, as the private link on the website shows it: the
   package, the credits, the classes booked against it. */
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { longDate, money } from '@/lib/format';
import { statusLabel, statusTone } from '@/lib/catalogue';
import { Card, Empty, ErrorNote, Eyebrow, Loading, Pill, Row, Screen, Title, st } from '@/components/ui';

export default function ReservationView() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const { t, lang } = useT();
  const { data, loading, error, refreshing, reload } = useData<any[]>('/api/client/reservations');
  if (loading) return <Loading />;
  const r = (data || []).find(x => x.ref === ref);
  if (!r) return <Screen><ErrorNote text={error || 'Booking not found'} /></Screen>;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Title sub={r.ref}>{r.title}</Title>
      <Row style={{ marginBottom: 12 }}>
        <Pill label={statusLabel(r.status)} tone={statusTone(r.status)} />
        <Pill label={r.payment === 'paid' ? 'Paid' : 'Pay at the studio'} tone={r.payment === 'paid' ? 'good' : 'neutral'} />
        {r.totalPrice != null ? <Text style={[st.body, { fontWeight: '600' }]}>{money(r.totalPrice, lang)}</Text> : null}
      </Row>
      {r.people.map((p: any) => (
        <Card key={p.index}>
          <Text style={st.muted}>{t('%s – %s', longDate(p.start, lang, true), longDate(p.end, lang))}</Text>
          {p.lines.map((l: any) => (
            <Row key={l.index} style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={st.body}>{l.label}</Text>
              <Text style={[st.body, { fontWeight: '600' }]}>{l.left == null ? t('Unlimited') : t('%s of %s left', l.left, l.total)}</Text>
            </Row>
          ))}
        </Card>
      ))}
      <Eyebrow>Classes</Eyebrow>
      {!r.bookings.length ? <Empty text="No classes booked on this reservation yet." /> : r.bookings.map((b: any) => (
        <Card key={b.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={[st.body, { fontWeight: '600' }]}>{longDate(b.date, lang, true)} · {b.start}</Text>
              <Text style={st.muted}>{t(b.typeName)}{b.instructor ? ' · ' + b.instructor : ''}</Text>
            </View>
            <Pill label={b.classCancelled ? 'Cancelled' : b.status === 'booked' ? (b.attendance === 'attended' ? 'Attended' : b.attendance === 'noshow' ? 'No-show' : 'Booked') : b.status === 'late' ? 'Late cancel' : 'Cancelled'}
              tone={b.status === 'booked' && !b.classCancelled ? 'good' : 'neutral'} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
