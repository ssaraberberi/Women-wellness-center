import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text as RNText, TextInput, View } from 'react-native';
import { Button, Gap, Header, Notice, Screen, Text } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { errorText, useT } from '@/lib/i18n';
import { completeSignIn } from '@/lib/session';
import { colors, fonts, radius, space } from '@/theme';

/** Six boxes over one hidden input: paste, autofill (iOS one-time-code) and backspace all just work. */
export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const { t, lang } = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(45);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const submit = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<any>('POST', '/auth/otp/verify', { body: { email, code: value }, auth: false });
      if (res.status === 'needs_profile') {
        router.replace({ pathname: '/register', params: { token: res.registrationToken, email } });
      } else {
        await completeSignIn(res);
        router.replace('/');
      }
    } catch (e) {
      const left = e instanceof ApiError ? e.details?.attemptsLeft : undefined;
      setError(errorText(e, lang) + (left !== undefined ? ` (${left})` : ''));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await api('POST', '/auth/otp/request', { body: { email, lang }, auth: false });
      setWait(45);
    } catch (e) {
      setError(errorText(e, lang));
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={t('enterCode')} back />
      <Text variant="body">{t('codeSentTo', { email: email ?? '' })}</Text>
      <Gap h={space.xxl} />
      <Pressable onPress={() => input.current?.focus()} accessibilityLabel={t('enterCode')}>
        <View style={styles.boxes}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={[styles.box, code.length === i && styles.boxActive]}>
              <RNText style={styles.digit}>{code[i] ?? ''}</RNText>
            </View>
          ))}
        </View>
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 6);
          setCode(digits);
          if (digits.length === 6) void submit(digits);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        style={styles.hidden}
      />
      {error ? (
        <>
          <Gap h={space.md} />
          <Notice text={error} tone="danger" icon="alert-circle" />
        </>
      ) : null}
      <Gap h={space.xl} />
      <Button title={t('verify')} onPress={() => submit()} loading={busy} disabled={code.length !== 6} />
      <Gap h={space.sm} />
      <Button variant="ghost" title={wait > 0 ? t('resendIn', { s: wait }) : t('resend')} disabled={wait > 0} onPress={resend} />
      <Button variant="ghost" title={t('changeEmail')} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'space-between' },
  box: { width: 48, height: 58, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  boxActive: { borderColor: colors.wine, borderWidth: 1.5 },
  digit: { fontFamily: fonts.semibold, fontSize: 24, color: colors.ink },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
