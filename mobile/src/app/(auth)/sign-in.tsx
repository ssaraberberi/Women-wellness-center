import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { z } from 'zod';
import { Button, Field, Gap, Header, Notice, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useT } from '@/lib/i18n';
import { logoLockup } from '@/lib/images';
import { colors, space } from '@/theme';

const emailSchema = z.email();

export default function SignIn() {
  const router = useRouter();
  const { t, lang } = useT();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = email.trim().toLowerCase();
    if (!emailSchema.safeParse(value).success) return setError(t('invalidEmail'));
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/auth/otp/request', { body: { email: value, lang }, auth: false });
      router.push({ pathname: '/verify', params: { email: value } });
    } catch (e) {
      setError(errorText(e, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="" back />
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <Image source={logoLockup} style={{ width: 170, height: 90 }} contentFit="contain" tintColor={colors.wine} accessibilityLabel="DUA Pilates & SPA" />
        </View>
        <Gap h={space.xxxl} />
        <Text variant="display" center>
          {t('welcome')}
        </Text>
        <Text variant="body" center style={{ marginTop: space.sm, marginBottom: space.xxl }}>
          {t('welcomeSub')}
        </Text>
        <Field
          placeholder={t('email')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={submit}
          autoFocus
        />
        {error ? <Notice text={error} tone="danger" icon="alert-circle" /> : null}
        <Gap h={space.md} />
        <Button title={t('sendCode')} onPress={submit} loading={busy} />
        <Gap h={space.xxxl} />
        <Text variant="small" center>
          {t('terms')}
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}
