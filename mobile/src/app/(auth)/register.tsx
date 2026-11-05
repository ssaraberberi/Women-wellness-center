import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { z } from 'zod';
import { Button, Field, Gap, Header, Notice, PhoneField, PrivacyNotice, Screen, Text, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import { zodResolver } from '@/lib/forms';
import { errorText, useT } from '@/lib/i18n';
import { strongPassword } from '@/lib/password';
import { checkPhone } from '@/lib/phone';
import { completeSignIn } from '@/lib/session';
import { space } from '@/theme';

const schema = (apple: boolean) =>
  z.object({
    firstName: z.string().trim().min(1, 'required').max(60),
    lastName: z.string().trim().min(1, 'required').max(60),
    phone: z.string().refine((v) => !!checkPhone(v), 'invalidPhone'),
    // With Apple she signs in with Apple; a password is optional (it can be set later).
    password: z.string().refine((p) => (apple && !p) || strongPassword(p), 'passwordHint'),
    marketingConsent: z.boolean(),
  });
type Form = z.infer<ReturnType<typeof schema>>;

/** The email is proven (by code or by Apple); now the person. The account is always a client — staff are invited by the studio. */
export default function Register() {
  const params = useLocalSearchParams<{ token: string; email?: string; apple?: string; firstName?: string; lastName?: string }>();
  const apple = params.apple === '1';
  const router = useRouter();
  const { t, lang } = useT();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema(apple)),
    defaultValues: { firstName: params.firstName ?? '', lastName: params.lastName ?? '', phone: '', password: '', marketingConsent: false },
  });

  const submit = handleSubmit(async ({ password, ...values }) => {
    setError(null);
    try {
      // Sent in E.164 ("+355691234567"); the API checks it again.
      const res = await api<any>('POST', '/auth/register', {
        body: { registrationToken: params.token, language: lang, ...values, phone: checkPhone(values.phone)!.e164, ...(password ? { password } : {}) },
        auth: false,
      });
      await completeSignIn(res);
      router.replace('/');
    } catch (e) {
      setError(errorText(e, lang));
    }
  });

  const msg = (k?: string) => (k ? t(k as 'required') : undefined);

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title={t('aboutYou')} />
        <Text variant="body" style={{ marginBottom: space.xl }}>
          {t('aboutYouSub')}
        </Text>
        <Controller control={control} name="firstName" render={({ field, fieldState }) => (
          <Field label={t('firstName')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} autoComplete="given-name" textContentType="givenName" error={msg(fieldState.error?.message)} />
        )} />
        <Controller control={control} name="lastName" render={({ field, fieldState }) => (
          <Field label={t('lastName')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} autoComplete="family-name" textContentType="familyName" error={msg(fieldState.error?.message)} />
        )} />
        <Controller control={control} name="phone" render={({ field, fieldState }) => (
          <PhoneField label={t('phone')} value={field.value} onChangeText={field.onChange} error={msg(fieldState.error?.message)} />
        )} />
        <Controller control={control} name="password" render={({ field, fieldState }) => (
          <Field label={apple ? t('passwordOptional') : t('password')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" error={msg(fieldState.error?.message)} />
        )} />
        <Text variant="small" style={{ marginTop: -6, marginBottom: space.md }}>{t('passwordHint')}</Text>
        <Controller control={control} name="marketingConsent" render={({ field }) => (
          <ToggleRow label={t('marketingConsent')} value={field.value} onChange={field.onChange} />
        )} />
        {error ? <Notice text={error} tone="danger" icon="alert-circle" /> : null}
        <Gap h={space.xl} />
        <Button title={t('createAccount')} onPress={submit} loading={formState.isSubmitting} />
        <Gap h={space.lg} />
        <PrivacyNotice />
      </KeyboardAvoidingView>
    </Screen>
  );
}
