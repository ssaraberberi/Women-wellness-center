import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { z } from 'zod';
import { Alert } from '@/lib/alert';
import { Button, Card, ErrorState, Field, Gap, Header, KeyValue, Notice, PhoneField, Screen, SkeletonList, Text } from '@/components/ui';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { lek, longDate, time } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { checkPhone } from '@/lib/phone';
import { completeSignIn } from '@/lib/session';
import { loc, type PublicSession } from '@/lib/types';
import { space } from '@/theme';

type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };
type Result =
  | { status: 'booked'; session: Tokens; booking: { id: string; payment: { total: number } | null } }
  | { status: 'has_package'; session: Tokens; credits: number }
  | { status: 'not_booked'; session: Tokens; error: { code: string; message: string } }
  | { status: 'already_booked' };

/**
 * Booking one class without an account: who she is, then the code we email
 * her. Proving the email signs her in (no password), so she lands in her own
 * app with the class booked — or, with sessions in a package, chooses there.
 */
export default function GuestBook() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['public-session', id], queryFn: () => api<{ singlePrice: number | null; session: PublicSession }>('GET', `/public/sessions/${id}`, { auth: false }) });
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [f, setF] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const phone = checkPhone(f.phone);
  const emailOk = z.email().safeParse(f.email.trim()).success;
  const formOk = !!f.firstName.trim() && !!f.lastName.trim() && !!phone && emailOk;
  const s = q.data?.session;
  const price = q.data?.singlePrice;

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/public/guest-bookings/code', { body: { sessionId: id, email: f.email.trim(), lang }, auth: false });
      setStep('code');
      setCode('');
    } catch (e) {
      setError(errorText(e, lang));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<Result>('POST', '/public/guest-bookings', {
        auth: false,
        idempotencyKey: key.current,
        body: { sessionId: id, firstName: f.firstName.trim(), lastName: f.lastName.trim(), phone: phone!.e164, email: f.email.trim(), code: value, lang, platform: 'APP' },
      });
      if (r.status === 'already_booked') {
        Alert.alert('DUA', t('guestAlready'));
        return;
      }
      await completeSignIn(r.session);
      if (r.status === 'booked') router.replace({ pathname: '/client/booked', params: { kind: 'class', sessionId: id } });
      else if (r.status === 'has_package') router.replace({ pathname: '/client/class/[id]', params: { id } });
      else {
        Alert.alert('DUA', errorText(new ApiError(409, r.error.code, r.error.message), lang));
        router.replace('/client/book');
      }
    } catch (e) {
      setError(errorText(e, lang));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  if (q.isPending) return <Screen><Header title="" back /><SkeletonList count={4} /></Screen>;
  if (!s) return <Screen><Header title="" back /><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Screen>;

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        step === 'form' ? (
          <Button title={t('sendMeCode')} onPress={sendCode} loading={busy} disabled={!formOk || !price} />
        ) : (
          <Button title={t('confirmBooking')} onPress={() => confirm()} loading={busy} disabled={code.length !== 6} />
        )
      }
    >
      <Header title={step === 'form' ? t('guestDetails') : t('enterCode')} back />
      <Card>
        <Text variant="heading">{loc(lang, s.classType.name, s.classType.nameEn)}</Text>
        <KeyValue icon="calendar" text={longDate(s.startsAt, lang)} />
        <KeyValue icon="clock" text={`${time(s.startsAt)} – ${time(s.endsAt)}`} />
        {s.instructor ? <KeyValue icon="user" text={s.instructor.name} /> : null}
        {price ? <KeyValue icon="tag" text={t('guestPrice', { price: lek(price) })} /> : null}
      </Card>
      <Gap h={space.lg} />
      {!price ? <Notice tone="warning" icon="alert-circle" text={t('onlineOff')} /> : null}
      {step === 'form' ? (
        <>
          <Text variant="body" style={{ marginBottom: space.md }}>{t('guestDetailsSub')}</Text>
          <Field label={t('firstName')} value={f.firstName} onChangeText={(v) => setF({ ...f, firstName: v })} autoCapitalize="words" autoComplete="given-name" />
          <Field label={t('lastName')} value={f.lastName} onChangeText={(v) => setF({ ...f, lastName: v })} autoCapitalize="words" autoComplete="family-name" />
          <PhoneField label={t('phone')} value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} />
          <Field
            label={t('email')}
            value={f.email}
            onChangeText={(v) => setF({ ...f, email: v })}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={f.email.trim() && !emailOk ? t('invalidEmail') : undefined}
          />
        </>
      ) : (
        <>
          <Text variant="body" style={{ marginBottom: space.md }}>{t('codeSentTo', { email: f.email.trim() })}</Text>
          <Field
            label={t('enterCode')}
            value={code}
            onChangeText={(v) => {
              const d = v.replace(/\D/g, '').slice(0, 6);
              setCode(d);
              if (d.length === 6) void confirm(d);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
          />
          <Button variant="ghost" title={t('resend')} onPress={sendCode} disabled={busy} />
          <Button variant="ghost" title={t('changeEmail')} onPress={() => setStep('form')} />
        </>
      )}
      {error ? <Notice tone="danger" icon="alert-circle" text={error} /> : null}
    </Screen>
  );
}
