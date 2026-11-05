import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Alert } from 'react-native';
import { Button, Card, ErrorState, Gap, Header, KeyValue, Notice, Row, Screen, SkeletonList, Text } from '@/components/ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { lek } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { loc, type Product } from '@/lib/types';
import { colors, space } from '@/theme';

export default function PackageDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['products'], queryFn: () => api<Product[]>('GET', '/products') });
  const p = q.data?.find((x) => x.id === id);
  const key = useRef(newIdempotencyKey());

  // No promo codes in the app: any discount is given by the studio when it sells the package.
  const order = useMutation({
    mutationFn: () => api<any>('POST', '/orders', { body: { productId: id }, idempotencyKey: key.current }),
    onSuccess: (o) => {
      void qc.invalidateQueries({ queryKey: ['memberships'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
      Alert.alert(t('orderPlaced'), `${t('orderRef', { ref: o.reference })}\n\n${o.status === 'PAID' || o.purchase?.status === 'ACTIVE' ? '' : t('payAtStudio')}`, [
        { text: 'OK', onPress: () => router.replace('/client/memberships') },
      ]);
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });

  return (
    <Screen
      edges={['top']}
      footer={p ? <Button title={`${t('buy')} · ${lek(p.price)}`} onPress={() => order.mutate()} loading={order.isPending} /> : undefined}
    >
      <Header title={p ? loc(lang, p.name, p.nameEn) : ''} back />
      {q.isPending ? (
        <SkeletonList count={3} />
      ) : !p ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <Text variant="body">{loc(lang, p.description, p.descriptionEn)}</Text>
          <Gap h={space.md} />
          {p.classCredits ? <KeyValue icon="layers" text={t('classesN', { n: p.classCredits })} /> : null}
          {p.spaItems.map((s) => (
            <KeyValue key={s.id} icon="feather" text={`${s.quantity} × ${s.treatment?.name ?? s.category ?? 'SPA'}`} />
          ))}
          <KeyValue icon="calendar" text={t('validDays', { n: p.validityDays })} />
          {p.sessionsPerWeekHint ? <KeyValue icon="repeat" text={t('perWeek', { n: p.sessionsPerWeekHint })} /> : null}
          {p.terms ? (
            <>
              <Gap h={space.md} />
              <Text variant="label">{t('termsTitle').toUpperCase()}</Text>
              <Text variant="small" style={{ color: colors.inkSoft }}>{loc(lang, p.terms, p.termsEn)}</Text>
            </>
          ) : null}
          <Gap h={space.xl} />
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="body">{t('subtotal')}</Text>
              <Text variant="bodyMedium">{p.originalPrice ? `${lek(p.originalPrice)} → ` : ''}{lek(p.price)}</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
              <Text variant="heading">{t('total')}</Text>
              <Text variant="title">{lek(p.price)}</Text>
            </Row>
          </Card>
          <Gap h={space.md} />
          <Notice icon="info" text={t('payAtStudio')} />
        </>
      )}
    </Screen>
  );
}
