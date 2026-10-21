/* The studio at a glance: the week in numbers, what needs a hand, and
   the one switch the website reads — whether it shows prices. */
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as rules from '@shared/rules.js';
import { todayIn, plusDays } from '@shared/domain.js';
import { put } from '@/lib/api';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { longDate } from '@/lib/format';
import { Button, Card, Empty, ErrorNote, Eyebrow, Loading, Row, Screen, st } from '@/components/ui';
import { C, serif } from '@/lib/theme';

export default function Studio() {
  const { t, lang } = useT();
  const { data: s, error, loading, refreshing, reload } = useData<any>('/api/admin/state');
  const res = useData<any[]>('/api/admin/reservations');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (!s) return <Screen><ErrorNote text={error} /><Button label="Try again" onPress={reload} /></Screen>;

  const today = todayIn(new Date());
  const week = plusDays(today, 6);
  const live = (k: any) => !k.cancelled;
  const todays = s.classes.filter((k: any) => k.date === today && live(k));
  const weekClasses = s.classes.filter((k: any) => k.date >= today && k.date <= week && live(k));
  const booked = (ks: any[]) => ks.reduce((n, k) => n + rules.spots(s, k).taken, 0);
  const places = (ks: any[]) => ks.reduce((n, k) => n + k.capacity, 0);
  const pending = (res.data || []).filter(r => r.status === 'pending').length;
  const unpaid = (res.data || []).filter(r => r.payment === 'unpaid' && r.status !== 'cancelled').length;
  const issues = (s.issues || []).slice(0, 20);

  const stat = (n: number | string, label: string) => (
    <Card style={{ flex: 1, marginBottom: 0 }}>
      <Text style={{ fontFamily: serif, fontSize: 28, color: C.wine }}>{n}</Text>
      <Text style={st.muted}>{t(label)}</Text>
    </Card>
  );

  const togglePrices = async (v: boolean) => {
    setBusy(true);
    try { await put('/api/admin/settings', { showPrices: v }); await reload(); } finally { setBusy(false); }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { reload(); res.reload(); }}>
      <Eyebrow>Today</Eyebrow>
      <Row style={{ marginBottom: 8 }}>{stat(todays.length, 'Classes')}{stat(booked(todays) + '/' + places(todays), 'Places booked')}</Row>
      <Eyebrow>Next 7 days</Eyebrow>
      <Row style={{ marginBottom: 8 }}>{stat(weekClasses.length, 'Classes')}{stat(places(weekClasses) ? Math.round(100 * booked(weekClasses) / places(weekClasses)) + '%' : '—', 'Full')}</Row>
      <Eyebrow>Reservations</Eyebrow>
      <Row style={{ marginBottom: 8 }}>{stat(pending, 'Pending')}{stat(unpaid, 'Unpaid')}</Row>

      <Eyebrow>Needs attention</Eyebrow>
      {!issues.length ? <Empty text="Nothing needs attention." /> : issues.map((i: any, n: number) => (
        <Card key={n} onPress={() => router.push({ pathname: '/admin/class/[id]', params: { id: i.klass.id } })}>
          <Text style={[st.body, { fontWeight: '600' }]}>{longDate(i.klass.date, lang, true)} · {i.klass.start}</Text>
          <Text style={{ color: C.warn }}>
            {i.kind === 'unassigned' ? t('Nobody assigned') : i.kind === 'overfull' ? t('Overbooked') :
             i.kind === 'outside-package' ? t('A booking is outside its package dates') : (i.who ? i.who + ' — ' : '') + t(i.why || i.kind)}</Text>
        </Card>
      ))}

      <Eyebrow>Website</Eyebrow>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={st.body}>{t('Show prices on the website')}</Text>
            <Text style={st.muted}>{t('Off, the website lists the packages and says the price comes at opening.')}</Text>
          </View>
          <Switch value={!!s.showPrices} disabled={busy} onValueChange={togglePrices} trackColor={{ true: C.wine, false: C.line }} />
        </Row>
      </Card>
      <Card>
        <Text style={st.muted}>{t('Opening date')}: <Text style={st.body}>{longDate(s.settings.openingDate, lang)}</Text></Text>
        <Text style={st.muted}>{t('Cancellation window')}: <Text style={st.body}>{t('%s minutes', s.settings.cancelMinutes)}</Text></Text>
        <Text style={st.muted}>{t('Booking opens')}: <Text style={st.body}>{t('%s days ahead', s.settings.horizonDays)}</Text></Text>
        <Text style={[st.muted, { marginTop: 8, fontSize: 12 }]}>{t('The weekly timetable, packages and offers are edited on the website, at /app.')}</Text>
      </Card>
      {s.mail && !s.mail.configured ? (
        <Card style={{ backgroundColor: C.warnBg, borderColor: C.warnBg }}>
          <Text style={{ color: C.warn }}>{t('Email is not set up, so password reset links are not being sent.')}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}
