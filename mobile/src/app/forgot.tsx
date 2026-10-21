import { useState } from 'react';
import { post } from '@/lib/api';
import { Body, Button, Card, ErrorNote, Field, Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';

/* The same letter the website sends: a one-hour link. The answer never
   says whether the address has an account. */
export default function Forgot() {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    if (!email.trim()) return setError('Write your email');
    setBusy(true); setError(null);
    try { await post('/api/auth/forgot', { email: email.trim() }); setSent(true); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      {sent ? (
        <Card tone="sand"><Body>{t('If that address has an account, a link is on its way. It works for one hour.')}</Body></Card>
      ) : (
        <>
          <Body muted style={{ marginBottom: 16 }}>{t('Write the email on your account and we will send a link to choose a new password.')}</Body>
          <ErrorNote text={error} />
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Button label="Send the link" onPress={go} busy={busy} />
          <Body muted style={{ marginTop: 16 }}>{t('No access to that inbox? The studio can reset your password at the desk.')}</Body>
        </>
      )}
    </Screen>
  );
}
