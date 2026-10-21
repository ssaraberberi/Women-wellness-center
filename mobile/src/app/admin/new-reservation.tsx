/* A reservation made at the desk — for a client already on the books or
   somebody new — with any package, or an offer. The server applies the
   same rules the booking page does; the desk only skips the waiting. */
import { useMemo, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { post } from '@/lib/api';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { linesLabel } from '@/lib/catalogue';
import { money } from '@/lib/format';
import { Button, Card, ErrorNote, Eyebrow, Field, Loading, Row, Screen, Segmented, st } from '@/components/ui';
import { C } from '@/lib/theme';

export default function NewReservation() {
  const { t, lang } = useT();
  const { data: s, loading, error } = useData<any>('/api/admin/state');
  const [who, setWho] = useState<'client' | 'new'>('client');
  const [q, setQ] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [person, setPerson] = useState({ name: '', phone: '', email: '' });
  const [what, setWhat] = useState<string | null>(null);         // 'plan:id' or 'offer:id'
  const [planForOffer, setPlanForOffer] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!s || n.length < 2) return [];
    const d = n.replace(/\D/g, '');
    return s.clients.filter((c: any) => c.name.toLowerCase().includes(n) ||
      (d.length >= 3 && String(c.phone || '').replace(/\D/g, '').includes(d))).slice(0, 8);
  }, [s, q]);

  if (loading) return <Loading />;
  if (!s) return <Screen><ErrorNote text={error} /></Screen>;

  const plans = s.plans.filter((p: any) => !p.archived && p.allowances.length);
  const offers = s.offers.filter((o: any) => o.active && !o.archived && o.persons === 1);
  const offer = what && what.startsWith('offer:') ? offers.find((o: any) => 'offer:' + o.id === what) : null;
  const chosen = clientId ? s.clients.find((c: any) => c.id === clientId) : null;

  const go = async () => {
    if (who === 'client' && !clientId) return setFail('Pick a client');
    if (!what) return setFail('Choose a package');
    if (offer && offer.kind !== 'bundle' && !planForOffer) return setFail('Choose a package');
    setBusy(true); setFail(null);
    try {
      const r = await post('/api/admin/reservations', {
        clientId: who === 'client' ? clientId : undefined,
        people: who === 'new' ? [person] : undefined,
        planId: offer ? (offer.kind === 'bundle' ? undefined : planForOffer) : what.slice(5),
        offerId: offer ? offer.id : undefined,
        status: 'confirmed', payment: paid ? 'paid' : 'unpaid', classIds: []
      });
      router.replace({ pathname: '/admin/reservation/[id]', params: { id: r.reservation.id } });
    } catch (e: any) { setFail(e.message); }
    finally { setBusy(false); }
  };

  const option = (key: string, title: string, sub: string) => (
    <Pressable key={key} onPress={() => setWhat(key)}>
      <Card style={what === key ? { borderColor: C.wine, borderWidth: 2 } : undefined}>
        <Text style={[st.body, { fontWeight: '600' }]}>{title}</Text>
        <Text style={st.muted}>{sub}</Text>
      </Card>
    </Pressable>
  );

  return (
    <Screen>
      <Eyebrow>Who</Eyebrow>
      <Segmented value={who} onChange={setWho} options={[{ value: 'client', label: 'A client' }, { value: 'new', label: 'Someone new' }]} />
      {who === 'client' ? (
        chosen ? (
          <Card tone="sand">
            <Row style={{ justifyContent: 'space-between' }}>
              <View><Text style={[st.body, { fontWeight: '600' }]}>{chosen.name}</Text><Text style={st.muted}>{chosen.phone}</Text></View>
              <Button small kind="ghost" label="Change" onPress={() => setClientId(null)} />
            </Row>
          </Card>
        ) : (
          <>
            <Field label="Search" value={q} onChangeText={setQ} placeholder={t('Name or phone')} />
            {matches.map((c: any) => (
              <Card key={c.id} onPress={() => setClientId(c.id)}>
                <Text style={[st.body, { fontWeight: '600' }]}>{c.name}</Text>
                <Text style={st.muted}>{c.phone || c.email}</Text>
              </Card>
            ))}
          </>
        )
      ) : (
        <>
          <Field label="Full name" value={person.name} onChangeText={v => setPerson(p => ({ ...p, name: v }))} />
          <Field label="Phone" value={person.phone} keyboardType="phone-pad" onChangeText={v => setPerson(p => ({ ...p, phone: v }))} />
          <Field label="Email (optional)" value={person.email} autoCapitalize="none" keyboardType="email-address" onChangeText={v => setPerson(p => ({ ...p, email: v }))} />
        </>
      )}

      <Eyebrow>Package</Eyebrow>
      {plans.map((p: any) => option('plan:' + p.id, p.name,
        linesLabel(p.allowances.map((a: any) => ({ types: a.types, total: a.limit })), s.classTypes, lang) + ' · ' + money(p.price, lang)))}
      {offers.length ? <Eyebrow>Offers</Eyebrow> : null}
      {offers.map((o: any) => option('offer:' + o.id, o.title,
        o.kind === 'discount' ? '−' + o.discountPct + '%' : o.kind === 'bundle' ? money(o.price, lang) : t('%s bonus classes', o.bonusClasses)))}
      {offer && offer.kind !== 'bundle' ? (
        <>
          <Text style={[st.muted, { marginBottom: 6 }]}>{t('Which package does the offer go on?')}</Text>
          <Row style={{ flexWrap: 'wrap', marginBottom: 8 }}>
            {plans.filter((p: any) => !offer.eligiblePlans.length || offer.eligiblePlans.includes(p.id)).map((p: any) => (
              <Button key={p.id} small kind={planForOffer === p.id ? 'primary' : 'secondary'} label={p.name} onPress={() => setPlanForOffer(p.id)} />
            ))}
          </Row>
        </>
      ) : null}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={st.body}>{t('Paid already')}</Text>
          <Switch value={paid} onValueChange={setPaid} trackColor={{ true: C.wine, false: C.line }} />
        </Row>
      </Card>
      <ErrorNote text={fail} />
      <Button label="Create reservation" onPress={go} busy={busy} />
    </Screen>
  );
}
