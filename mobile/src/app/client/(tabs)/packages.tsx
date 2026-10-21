/* What the studio sells, as the website lists it, and what she has
   already reserved. A package is reserved here and paid at the studio. */
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { inLang, linesLabel, statusLabel, statusTone } from '@/lib/catalogue';
import { money, shortDate } from '@/lib/format';
import { Card, Empty, ErrorNote, Eyebrow, Loading, Pill, Row, Screen, st } from '@/components/ui';
import { C } from '@/lib/theme';

export default function Packages() {
  const { t, lang } = useT();
  const cat = useData<any>('/api/public/book');
  const mine = useData<any[]>('/api/client/reservations');
  if (cat.loading) return <Loading />;
  const c = cat.data;
  const reload = () => { cat.reload(); mine.reload(); };
  const offers = (c?.offers || []).filter((o: any) => o.persons === 1);

  return (
    <Screen refreshing={cat.refreshing} onRefresh={reload}>
      <ErrorNote text={cat.error} />
      {mine.data && mine.data.length ? (
        <>
          <Eyebrow>Your reservations</Eyebrow>
          {mine.data.map(r => (
            <Card key={r.ref} onPress={() => router.push({ pathname: '/client/reservation/[ref]', params: { ref: r.ref } })}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[st.body, { fontWeight: '600', flex: 1 }]}>{r.title}</Text>
                <Pill label={statusLabel(r.status)} tone={statusTone(r.status)} />
              </Row>
              <Text style={st.muted}>{r.ref} · {r.payment === 'paid' ? t('Paid') : t('Pay at the studio')}</Text>
            </Card>
          ))}
        </>
      ) : null}

      {offers.length ? <Eyebrow>Offers</Eyebrow> : null}
      {offers.map((o: any) => (
        <Card key={o.id} tone="wine" onPress={() => router.push({ pathname: '/client/reserve', params: { offer: o.id } })}>
          <Text style={[st.h2, { color: C.cream }]}>{o.title}</Text>
          <Text style={{ color: C.cream, opacity: 0.9, lineHeight: 20 }}>{inLang(o.description, o.en?.description, lang)}</Text>
          {o.endsOn ? <Text style={{ color: C.cream, opacity: 0.8, marginTop: 6, fontSize: 13 }}>{t('Until %s', shortDate(o.endsOn, lang))}</Text> : null}
        </Card>
      ))}

      <Eyebrow>Packages</Eyebrow>
      {!c?.plans?.length ? <Empty text="The packages are coming soon." /> : c.plans.map((p: any) => (
        <Card key={p.id} onPress={() => router.push({ pathname: '/client/reserve', params: { plan: p.id } })}
          style={p.featured ? { borderColor: C.wine, borderWidth: 2 } : undefined}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={st.h2}>{p.name}</Text>
              {inLang(p.tagline, p.en?.tagline, lang) ? <Text style={[st.muted, { color: C.wine }]}>{inLang(p.tagline, p.en?.tagline, lang)}</Text> : null}
            </View>
            <Text style={[st.body, { fontWeight: '700' }]}>{money(p.price, lang)}</Text>
          </Row>
          <Text style={[st.body, { marginTop: 8 }]}>{linesLabel(p.lines, c.classTypes, lang)}</Text>
          <Text style={st.muted}>{t('Valid for %s days', p.validityDays)}</Text>
        </Card>
      ))}
    </Screen>
  );
}
