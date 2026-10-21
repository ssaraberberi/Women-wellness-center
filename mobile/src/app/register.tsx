import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/lib/session';
import { Body, Button, ErrorNote, Field, Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';

/* A client account. Staff accounts are made by the studio, and the
   first administrator registers on the website with the studio's code. */
export default function Register() {
  const { register } = useSession();
  const { t } = useT();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));

  const go = async () => {
    if (f.name.trim().length < 2) return setError('Write the full name');
    if (f.phone.replace(/\D/g, '').length < 8) return setError('Write a phone number we can call');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setError('That email does not look right');
    if (f.password.length < 8) return setError('Password must be at least 8 characters');
    setBusy(true); setError(null);
    try { await register({ ...f, email: f.email.trim(), name: f.name.trim() }); router.replace('/'); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen>
        <Body muted style={{ marginBottom: 16 }}>{t('If you have booked at DUA before, use the same phone number — your packages will be waiting.')}</Body>
        <ErrorNote text={error} />
        <Field label="Full name" value={f.name} onChangeText={set('name')} autoComplete="name" textContentType="name" />
        <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="069 123 4567" />
        <Field label="Email" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <Field label="Password" value={f.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        <Body muted style={{ marginBottom: 12 }}>{t('At least 8 characters.')}</Body>
        <Button label="Create account" onPress={go} busy={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
