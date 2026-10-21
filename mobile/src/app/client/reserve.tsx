/* Reserving a package (or a live offer) as herself. The booking page's
   engine does the work on the server: the same prices written down, the
   same offer checks, the same "pending until paid at the studio". */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { post } from '@/lib/api';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { inLang, linesLabel } from '@/lib/catalogue';
import { money } from '@/lib/format';
import { Body, Button, Card, ErrorNote, Eyebrow, Field, Loading, Screen, Title, st } from '@/components/ui';
import { C } from '@/lib/theme';

export default function Reserve() {
  const { plan: planParam, offer: offerParam } = useLocalSearchParams<{ plan?: string; offer?: string }>();
  const { t, lang } = useT();
  const { data: c, loading, error } = useData<any>('/api/public/book');
  const [planId, setPlanId] = useState<string | null>(planParam || null);
  const [friend, setFriend] = useState({ name: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const [done, setDone] = useState<any>(null);

  if (loading) return <Loading />;
  if (!c) return <Screen><ErrorNote text={error} /></Screen>;

  const offer = offerParam ? c.offers.find((o: any) => o.id === offerParam) : null;
  const bundle = offer && offer.kind === 'bundle';
  const choices = offer && !bundle ? c.plans.filter((p: any) => offer.eligiblePlans.includes(p.id)) : [];
  const plan = c.plans.find((p: any) => p.id === planId) || null;
  const needsFriend = offer && offer.kind === 'bonus' && offer.friendRequired;

  if (offerParam && !offer) return <Screen><Body>{t('This offer is no longer available')}</Body></Screen>;

  const lines = bundle ? offer.lines : plan ? plan.lines : [];
  const base = bundle ? offer.price : plan ? plan.price : null;
  const pct = offer && offer.kind === 'discount' ? offer.discountPct || 0 : 0;
  const price = base == null ? null : Math.round(base * (100 - pct) / 100);

  const go = async () => {
    if (!bundle && !plan) return setFail('Choose a package');
    if (needsFriend && (friend.name.trim().length < 2 || friend.phone.replace(/\D/g, '').length < 8))
      return setFail('Write your friend\'s name and phone');
    setBusy(true); setFail(null);
    try {
      const r = await post('/api/client/reservations', {
        planId: bundle ? undefined : plan.id, offerId: offer ? offer.id : undefined,
        friend: needsFriend || friend.name.trim() ? friend : undefined, classIds: []
      });
      setDone(r);
    } catch (e: any) { setFail(e.message); }
    finally { setBusy(false); }
  };

  if (done) return (
    <Screen>
      <Title sub={done.ref}>{t('Reserved')}</Title>
      <Card tone="sand">
        <Body>{t('Your package is ready to use. Pay at the studio on your first visit; until then the reservation shows as pending.')}</Body>
      </Card>
      <Button label="Book your classes" onPress={() => { router.dismissAll(); router.replace('/client/book'); }} />
      <Button kind="ghost" label="Back to home" onPress={() => { router.dismissAll(); router.replace('/client'); }} />
    </Screen>
  );

  return (
    <Screen>
      <Title sub={offer ? inLang(offer.description, offer.en?.description, lang) : inLang(plan?.blurb, plan?.en?.blurb, lang) || null}>
        {offer ? offer.title : plan ? plan.name : t('Choose a package')}</Title>

      {choices.length ? (
        <>
          <Eyebrow>Choose a package</Eyebrow>
          {choices.map((p: any) => (
            <Pressable key={p.id} onPress={() => setPlanId(p.id)}>
              <Card style={planId === p.id ? { borderColor: C.wine, borderWidth: 2 } : undefined}>
                <Text style={[st.body, { fontWeight: '600' }]}>{p.name}</Text>
                <Text style={st.muted}>{linesLabel(p.lines, c.classTypes, lang)} · {money(p.price, lang)}</Text>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}

      {lines.length ? (
        <Card>
          <Text style={st.muted}>{t('What it includes')}</Text>
          <Text style={[st.body, { fontWeight: '600', marginBottom: 6 }]}>{linesLabel(lines, c.classTypes, lang)}</Text>
          <Text style={st.muted}>{t('Valid for %s days', bundle ? offer.validityDays : plan.validityDays)}</Text>
          {c.settings.showPrices ? (
            <Text style={[st.h2, { marginTop: 10, marginBottom: 0 }]}>
              {money(price, lang)}{pct ? '  ' : ''}{pct ? <Text style={[st.muted, { textDecorationLine: 'line-through' }]}>{money(base, lang)}</Text> : null}
            </Text>
          ) : <Text style={[st.muted, { marginTop: 10 }]}>{t('The price is confirmed at the studio.')}</Text>}
        </Card>
      ) : null}

      {offer && inLang(offer.eligibility, offer.en?.eligibility, lang) ? <Body muted>{inLang(offer.eligibility, offer.en?.eligibility, lang)}</Body> : null}

      {offer && offer.kind === 'bonus' ? (
        <>
          <Eyebrow>Your friend</Eyebrow>
          <Field label="Her full name" value={friend.name} onChangeText={v => setFriend(f => ({ ...f, name: v }))} />
          <Field label="Her phone" value={friend.phone} keyboardType="phone-pad" onChangeText={v => setFriend(f => ({ ...f, phone: v }))} />
        </>
      ) : null}

      <View style={{ height: 8 }} />
      <ErrorNote text={fail} />
      <Body muted style={{ marginBottom: 12 }}>{t('Nothing is charged in the app. You pay at the studio.')}</Body>
      <Button label="Reserve" onPress={go} busy={busy} disabled={!bundle && !plan} />
    </Screen>
  );
}
