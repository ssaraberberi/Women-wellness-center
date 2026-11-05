import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { z } from 'zod';
import { Button, Field, Gap, Header, Notice, Screen, Text } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { errorText, useT } from '@/lib/i18n';
import { strongPassword } from '@/lib/password';
import { completeSignIn } from '@/lib/session';
import { space } from '@/theme';

const emailSchema = z.email();

/** Forgotten password: a 6-digit code by email, then a new password. Signs her in and ends her other sign-ins. */
export default function Forgot() {
  const params = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { t, lang } = useT();
  const [email, setEmail] = useState(params.email ?? '');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const value = email.trim().toLowerCase();
    if (!emailSchema.safeParse(value).success) return setError(t('invalidEmail'));
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/auth/password/forgot', { body: { email: value, lang }, auth: false });
      setEmail(value);
      setSent(true);
    } catch (e) {
      setError(errorText(e, lang));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!/^\d{6}$/.test(code)) return setError(t('enterCode'));
    if (!strongPassword(password)) return setError(t('passwordHint'));
    setBusy(true);
    setError(null);
    try {
      const res = await api<any>('POST', '/auth/password/reset', { body: { email, code, password }, auth: false });
      await completeSignIn(res);
      router.replace('/');
    } catch (e) {
      const left = e instanceof ApiError ? e.details?.attemptsLeft : undefined;
      setError(errorText(e, lang) + (left !== undefined ? ` (${left})` : ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title={t('resetPassword')} back />
        {!sent ? (
          <>
            <Text variant="body" style={{ marginBottom: space.xl }}>{t('resetSub')}</Text>
            <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" onSubmitEditing={send} />
            {error ? <Notice text={error} tone="danger" icon="alert-circle" /> : null}
            <Gap h={space.md} />
            <Button title={t('sendCode')} onPress={send} loading={busy} />
          </>
        ) : (
          <>
            <Text variant="body" style={{ marginBottom: space.xl }}>{t('codeSentTo', { email })}</Text>
            <Field label={t('enterCode')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} />
            <Field label={t('newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
            <Text variant="small" style={{ marginTop: -6, marginBottom: space.md }}>{t('passwordHint')}</Text>
            {error ? <Notice text={error} tone="danger" icon="alert-circle" /> : null}
            <Gap h={space.md} />
            <Button title={t('savePasswordSignIn')} onPress={reset} loading={busy} />
            <Button variant="ghost" title={t('resend')} onPress={send} />
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
