import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { z } from 'zod';
import { Button, Field, Gap, Header, Notice, Screen, Text, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import { zodResolver } from '@/lib/forms';
import { errorText, useT } from '@/lib/i18n';
import { completeSignIn } from '@/lib/session';
import { space } from '@/theme';

const schema = z.object({
  firstName: z.string().trim().min(1, 'required').max(60),
  lastName: z.string().trim().max(60),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'invalidPhone'),
  marketingConsent: z.boolean(),
});
type Form = z.infer<typeof schema>;

/** The email is proven; now the person. The account is always a client — staff are invited by the studio. */
export default function Register() {
  const { token } = useLocalSearchParams<{ token: string; email: string }>();
  const router = useRouter();
  const { t, lang } = useT();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', phone: '+355 ', marketingConsent: false },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await api<any>('POST', '/auth/register', { body: { registrationToken: token, language: lang, ...values }, auth: false });
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
        <Controller control={control} name="lastName" render={({ field }) => (
          <Field label={t('lastName')} value={field.value} onChangeText={field.onChange} autoComplete="family-name" textContentType="familyName" />
        )} />
        <Controller control={control} name="phone" render={({ field, fieldState }) => (
          <Field label={t('phone')} value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" error={msg(fieldState.error?.message)} />
        )} />
        <Controller control={control} name="marketingConsent" render={({ field }) => (
          <ToggleRow label={t('marketingConsent')} value={field.value} onChange={field.onChange} />
        )} />
        {error ? <Notice text={error} tone="danger" icon="alert-circle" /> : null}
        <Gap h={space.xl} />
        <Button title={t('createAccount')} onPress={submit} loading={formState.isSubmitting} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
