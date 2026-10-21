import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { Button, ErrorNote, Field } from '@/components/ui';
import { LangSwitch } from '@/components/LangSwitch';
import { C, S, serif } from '@/lib/theme';

export default function SignIn() {
  const { signIn } = useSession();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    if (!email.trim() || !password) return setError('Write your email and password');
    setBusy(true); setError(null);
    try { await signIn(email, password); router.replace('/'); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <SafeAreaView edges={['top']} style={s.band}>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: S.l }}><LangSwitch light /></View>
        <Image source={require('../../assets/splash-icon.png')} style={s.logo} resizeMode="contain" accessibilityLabel="DUA" />
      </SafeAreaView>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: S.xl }} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>{t('Sign in to DUA')}</Text>
          <Text style={s.lede}>{t('Your classes, your package and your bookings, in your pocket.')}</Text>
          <ErrorNote text={error} />
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
            keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password"
            textContentType="password" returnKeyType="go" onSubmitEditing={go} />
          <Button label="Sign in" onPress={go} busy={busy} />
          <View style={{ marginTop: S.l, gap: S.m, alignItems: 'center' }}>
            <Link href="/forgot" style={s.link}>{t('Forgot your password?')}</Link>
            <Text style={s.muted}>{t('New to DUA?')} <Link href="/register" style={s.link}>{t('Create account')}</Link></Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  band: { backgroundColor: C.wine, paddingBottom: S.xl, paddingTop: S.s },
  logo: { width: 200, height: 150, alignSelf: 'center' },
  title: { fontFamily: serif, fontSize: 30, color: C.ink, marginBottom: S.s },
  lede: { fontSize: 15, color: C.muted, marginBottom: S.xl, lineHeight: 21 },
  link: { color: C.wine, fontWeight: '600', fontSize: 15 },
  muted: { color: C.muted, fontSize: 15 }
});
