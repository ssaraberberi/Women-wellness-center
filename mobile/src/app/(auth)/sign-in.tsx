import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { z } from 'zod';
import { Button, Field, Gap, Header, Notice, PrivacyNotice, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useT } from '@/lib/i18n';
import { logoLockup } from '@/lib/images';
import { completeSignIn } from '@/lib/session';
import { colors, space } from '@/theme';

const emailSchema = z.email();

/**
 * Email + password first. An emailed code still works — to sign in without a
 * password, and to create an account (it proves the inbox is hers).
 */
export default function SignIn() {
  const router = useRouter();
  const { t, lang } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'password' | 'code' | 'apple' | null>(null);

  const cleanEmail = () => {
    const value = email.trim().toLowerCase();
    if (!emailSchema.safeParse(value).success) {
      setError(t('invalidEmail'));
      return null;
    }
    return value;
  };

  // A password or a DUA code goes with her email or the username the studio gave her.
  const signIn = async () => {
    const value = email.trim().toLowerCase();
    if (!value) return setError(t('invalidEmail'));
    if (!password) return setError(t('enterPassword'));
    setBusy('password');
    setError(null);
    try {
      const res = await api<any>('POST', '/auth/login', { body: { email: value, password: /^dua-/i.test(password.trim()) ? password.trim().toUpperCase() : password }, auth: false });
      await completeSignIn(res);
      router.replace('/');
    } catch (e) {
      setError(errorText(e, lang));
    } finally {
      setBusy(null);
    }
  };

  // Used both to sign in with a code and to start a new account.
  const sendCode = async () => {
    const value = cleanEmail();
    if (!value) return;
    setBusy('code');
    setError(null);
    try {
      await api('POST', '/auth/otp/request', { body: { email: value, lang }, auth: false });
      router.push({ pathname: '/verify', params: { email: value } });
    } catch (e) {
      setError(errorText(e, lang));
    } finally {
      setBusy(null);
    }
  };

  // Sign in with Apple — iPhone only. New people still add their phone on the next screen.
  const [appleOk, setAppleOk] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setAppleOk).catch(() => setAppleOk(false));
  }, []);
  const withApple = async () => {
    setError(null);
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!cred.identityToken) throw new Error('no token');
      setBusy('apple');
      const res = await api<any>('POST', '/auth/apple', { body: { identityToken: cred.identityToken }, auth: false });
      if (res.status === 'needs_profile') {
        // Apple shares the name only the first time; pass it on to prefill.
        router.push({ pathname: '/register', params: { token: res.registrationToken, apple: '1', firstName: cred.fullName?.givenName ?? '', lastName: cred.fullName?.familyName ?? '' } });
      } else {
        await completeSignIn(res);
        router.replace('/');
      }
    } catch (e) {
      if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') setError(errorText(e, lang));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="" back />
        <View style={{ alignItems: 'center', marginTop: space.md }}>
          <Image source={logoLockup} style={{ width: 150, height: 80 }} contentFit="contain" tintColor={colors.wine} accessibilityLabel="DUA Pilates & SPA" />
        </View>
        <Gap h={space.xxl} />
        <Text variant="display" center>{t('welcome')}</Text>
        <Text variant="body" center style={{ marginTop: space.sm, marginBottom: space.xxl }}>{t('signInSub')}</Text>

        <Field
          label={t('emailOrUsername')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <Field
          label={t('password')}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={signIn}
        />
        <Button variant="ghost" small title={t('forgotPassword')} onPress={() => router.push({ pathname: '/forgot', params: { email: email.trim().toLowerCase() } })} style={{ alignSelf: 'flex-end', marginTop: -space.sm }} />
        {error ? <Notice text={error} tone="danger" icon="alert-circle" /> : null}
        <Gap h={space.md} />
        <Button title={t('signIn')} onPress={signIn} loading={busy === 'password'} />
        <Gap h={space.sm} />
        <Button variant="secondary" icon="mail" title={t('signInWithCode')} onPress={sendCode} loading={busy === 'code'} />
        {appleOk ? (
          <>
            <Gap h={space.sm} />
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={27}
              style={{ width: '100%', height: 54, opacity: busy === 'apple' ? 0.6 : 1 }}
              onPress={() => void (busy ? undefined : withApple())}
            />
          </>
        ) : null}

        <Gap h={space.xxl} />
        <Text variant="small" center>{t('noAccount')}</Text>
        <Button variant="ghost" title={t('createAccountCta')} onPress={sendCode} />
        <Gap h={space.xl} />
        <PrivacyNotice />
      </KeyboardAvoidingView>
    </Screen>
  );
}
