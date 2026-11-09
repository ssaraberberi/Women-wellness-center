import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from '@/lib/alert';
import { Button, Card, ErrorState, Field, Gap, Header, KeyValue, Notice, PhoneField, Row, Screen, SkeletonList, Text } from '@/components/ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { lek } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { checkPhone } from '@/lib/phone';
import { loc, offerPrice, type Catalogue, type Product } from '@/lib/types';
import { colors, space } from '@/theme';

type Person = { firstName: string; lastName: string; phone: string };
const empty: Person = { firstName: '', lastName: '', phone: '' };

/**
 * One package, or one package with an offer (a DUO, a discount, a bonus with a
 * friend). Reserved now, paid at the studio; the sessions start when it is paid.
 */
export default function PackageDetail() {
  const { id, offerId } = useLocalSearchParams<{ id: string; offerId?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['products'], queryFn: () => api<Product[]>('GET', '/products') });
  const cat = useQuery({ queryKey: ['catalogue'], queryFn: () => api<Catalogue>('GET', '/public/catalogue') });
  const offer = offerId ? cat.data?.offers.find((o) => o.id === offerId) : undefined;
  // A DUO package is not sold on its own, so it comes from its offer.
  const full = q.data?.find((x) => x.id === id);
  const p = full ?? (offer?.product?.id === id ? offer.product : cat.data?.products.find((x) => x.id === id));
  const key = useRef(newIdempotencyKey());
  const [partner, setPartner] = useState<Person>(empty);
  const [friend, setFriend] = useState<Person>(empty);

  const needsPartner = p?.persons === 2;
  const needsFriend = offer?.kind === 'BONUS';
  const personOk = (x: Person) => !!x.firstName.trim() && !!x.lastName.trim() && !!checkPhone(x.phone);
  const clean = (x: Person) => ({ firstName: x.firstName.trim(), lastName: x.lastName.trim(), phone: checkPhone(x.phone)!.e164 });
  const ready = !!p && (!needsPartner || personOk(partner)) && (!needsFriend || !offer?.friendRequired || personOk(friend));
  const price = p ? offerPrice(p.price, offer) : 0;

  const order = useMutation({
    mutationFn: () =>
      api<any>('POST', '/orders', {
        idempotencyKey: key.current,
        body: {
          productId: offer?.kind === 'BUNDLE' ? undefined : id,
          offerId: offer?.id,
          partner: needsPartner ? clean(partner) : undefined,
          friend: needsFriend && personOk(friend) ? clean(friend) : undefined,
        },
      }),
    onSuccess: (o) => {
      void qc.invalidateQueries({ queryKey: ['memberships'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
      void qc.invalidateQueries({ queryKey: ['catalogue'] });
      Alert.alert(t('orderPlaced'), `${t('orderRef', { ref: o.reference })}\n\n${o.status === 'PAID' || o.purchase?.status === 'ACTIVE' ? '' : t('creditsAfterPay')}`, [
        { text: 'OK', onPress: () => router.replace('/client/memberships') },
      ]);
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });

  const personFields = (x: Person, set: (v: Person) => void, title: string, hint: string) => (
    <Card style={{ marginTop: space.md }}>
      <Text variant="label">{title.toUpperCase()}</Text>
      <Gap h={space.sm} />
      <Field label={t('firstName')} value={x.firstName} onChangeText={(v) => set({ ...x, firstName: v })} autoCapitalize="words" />
      <Field label={t('lastName')} value={x.lastName} onChangeText={(v) => set({ ...x, lastName: v })} autoCapitalize="words" />
      <PhoneField label={t('phone')} value={x.phone} onChangeText={(v) => set({ ...x, phone: v })} />
      <Text variant="small" style={{ color: colors.inkSoft }}>{hint}</Text>
    </Card>
  );

  const loading = q.isPending || (!!offerId && cat.isPending);
  return (
    <Screen
      edges={['top']}
      footer={p ? <Button title={`${t('buy')} · ${lek(price)}`} onPress={() => order.mutate()} loading={order.isPending} disabled={!ready} /> : undefined}
    >
      <Header title={p ? (offer ? `${loc(lang, offer.title, offer.titleEn)}${offer.kind === 'BUNDLE' ? '' : ` · ${loc(lang, p.name, p.nameEn)}`}` : loc(lang, p.name, p.nameEn)) : ''} back />
      {loading ? (
        <SkeletonList count={3} />
      ) : !p ? (
        <ErrorState error={q.error ?? cat.error} onRetry={() => { void q.refetch(); void cat.refetch(); }} />
      ) : (
        <>
          <Text variant="body">{offer ? loc(lang, offer.description, offer.descriptionEn) || loc(lang, p.description, p.descriptionEn) : loc(lang, p.description, p.descriptionEn)}</Text>
          <Gap h={space.md} />
          {p.classCredits ? <KeyValue icon="layers" text={`${t('classesN', { n: p.classCredits })}${needsPartner ? ` × 2 · ${t('forTwo')}` : ''}`} /> : null}
          {full?.spaItems.map((s) => <KeyValue key={s.id} icon="feather" text={`${s.quantity} × ${s.treatment?.name ?? s.category ?? 'SPA'}`} />)}
          <KeyValue icon="calendar" text={t('validDays', { n: p.validityDays })} />
          {full?.sessionsPerWeekHint ? <KeyValue icon="repeat" text={t('perWeek', { n: full.sessionsPerWeekHint })} /> : null}
          {offer?.kind === 'BONUS' ? <KeyValue icon="gift" text={t('offerBonus', { n: offer.bonusClasses })} /> : null}
          {p.terms ? (
            <>
              <Gap h={space.md} />
              <Text variant="label">{t('termsTitle').toUpperCase()}</Text>
              <Text variant="small" style={{ color: colors.inkSoft }}>{loc(lang, p.terms, p.termsEn)}</Text>
            </>
          ) : null}
          {needsPartner ? personFields(partner, setPartner, t('duoPartner'), t('duoPartnerHint')) : null}
          {needsFriend ? personFields(friend, setFriend, t('friend'), t('friendHint')) : null}
          <Gap h={space.xl} />
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="body">{offer?.kind === 'DISCOUNT' ? t('regularPrice') : t('subtotal')}</Text>
              <Text variant="bodyMedium">{p.originalPrice ? `${lek(p.originalPrice)} → ` : ''}{lek(p.price)}</Text>
            </Row>
            {offer?.kind === 'DISCOUNT' ? (
              <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
                <Text variant="body">{loc(lang, offer.title, offer.titleEn)}</Text>
                <Text variant="bodyMedium">−{lek(p.price - price)}</Text>
              </Row>
            ) : null}
            <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
              <Text variant="heading">{t('total')}</Text>
              <Text variant="title">{lek(price)}</Text>
            </Row>
          </Card>
          <Gap h={space.md} />
          <Notice icon="info" text={t('creditsAfterPay')} />
          {(needsPartner && !personOk(partner)) || (needsFriend && offer?.friendRequired && !personOk(friend)) ? (
            <>
              <Gap h={space.sm} />
              <Notice icon="user" tone="warning" text={t('otherPersonName')} />
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
