import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, ErrorState, Field, Gap, Header, KeyValue, Notice, Row, Screen, SkeletonList, Text } from '@/components/ui';
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
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState<{ code: string; discount: number; total: number } | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());

  const check = useMutation({
    mutationFn: () => api<{ code: string; discount: number; total: number }>('POST', '/promotions/check', { body: { code: code.trim(), productId: id } }),
    onSuccess: (r) => {
      setQuote(r);
      setCodeError(null);
    },
    onError: (e) => {
      setQuote(null);
      setCodeError(errorText(e, lang));
    },
  });
  const order = useMutation({
    mutationFn: () => api<any>('POST', '/orders', { body: { productId: id, ...(quote ? { promoCode: quote.code } : {}) }, idempotencyKey: key.current }),
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
      footer={p ? <Button title={`${t('buy')} · ${lek(quote?.total ?? p.price)}`} onPress={() => order.mutate()} loading={order.isPending} /> : undefined}
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
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Field label={t('promoCode')} value={code} onChangeText={(v) => { setCode(v.toUpperCase()); setQuote(null); setCodeError(null); }} autoCapitalize="characters" error={codeError ?? undefined} />
            </View>
            <Button small variant="secondary" title={t('apply')} onPress={() => check.mutate()} disabled={!code.trim()} loading={check.isPending} style={{ marginBottom: space.md + (codeError ? 22 : 0) }} />
          </Row>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="body">{t('subtotal')}</Text>
              <Text variant="bodyMedium">{p.originalPrice ? `${lek(p.originalPrice)} → ` : ''}{lek(p.price)}</Text>
            </Row>
            {quote ? (
              <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <Row><Text variant="body">{t('discount')}</Text><Badge label={quote.code} tone="success" /></Row>
                <Text variant="bodyMedium" style={{ color: colors.success }}>−{lek(quote.discount)}</Text>
              </Row>
            ) : null}
            <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
              <Text variant="heading">{t('total')}</Text>
              <Text variant="title">{lek(quote?.total ?? p.price)}</Text>
            </Row>
          </Card>
          <Gap h={space.md} />
          <Notice icon="info" text={t('payAtStudio')} />
        </>
      )}
    </Screen>
  );
}
