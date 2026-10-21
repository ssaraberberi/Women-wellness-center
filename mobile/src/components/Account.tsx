/* The last tab in every role's app: who is signed in, the language, the
   notifications, and the way out. */
import { type ReactNode } from 'react';
import { Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { API_URL } from '@/lib/api';
import { Body, Button, Card, Eyebrow, Screen, Title, confirm, st } from './ui';
import { LangSwitch } from './LangSwitch';

export function Account({ children }: { children?: ReactNode }) {
  const { user, signOut } = useSession();
  const { t } = useT();
  if (!user) return null;
  const role = user.role === 'admin' ? 'Studio' : user.role === 'instructor' ? 'Staff' : 'Client';
  return (
    <Screen>
      <Title sub={t(role)}>{user.name}</Title>
      <Card>
        {user.email ? <Text style={st.body}>{user.email}</Text> : null}
        {user.phone ? <Text style={[st.muted, { marginTop: 4 }]}>{user.phone}</Text> : null}
      </Card>
      {children}
      <Eyebrow>Language</Eyebrow>
      <Card><LangSwitch /></Card>
      <Eyebrow>Notifications</Eyebrow>
      <Button kind="secondary" label="Open notifications" onPress={() => router.push('/notices')} />
      <Eyebrow>The studio</Eyebrow>
      <Card>
        <Body>DUA Pilates & Spa · Sheshi Wilson, Tiranë</Body>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
          <Text style={{ color: '#7D2F49', fontWeight: '600' }} onPress={() => Linking.openURL('https://wa.me/355697104072')}>WhatsApp</Text>
          <Text style={{ color: '#7D2F49', fontWeight: '600' }} onPress={() => Linking.openURL('tel:+355697104072')}>{t('Call')}</Text>
          <Text style={{ color: '#7D2F49', fontWeight: '600' }} onPress={() => Linking.openURL(API_URL)}>{t('Website')}</Text>
        </View>
      </Card>
      <View style={{ height: 16 }} />
      <Button kind="danger" label="Sign out" onPress={() =>
        confirm(t('Sign out'), t('You will need your password to sign in again.'), t('Sign out'), t('Cancel'),
          async () => { await signOut(); router.replace('/sign-in'); })} />
      <Text style={[st.muted, { textAlign: 'center', marginTop: 16, fontSize: 12 }]}>DUA {Constants.expoConfig?.version}</Text>
    </Screen>
  );
}
