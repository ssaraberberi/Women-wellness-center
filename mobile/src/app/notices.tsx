import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { post } from '@/lib/api';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { Card, Empty, ErrorNote, Loading, Screen, st } from '@/components/ui';
import { C } from '@/lib/theme';

type Notice = { id: string; text: string; tone: 'info' | 'good' | 'warn' | 'bad'; read: boolean; created_at: string };
const DOT = { info: C.wine, good: C.good, warn: C.warn, bad: C.bad };

/* The same list the web app shows under the bell. Opening it marks them read. */
export default function Notices() {
  const { t, lang } = useT();
  const { data, error, loading, refreshing, reload } = useData<Notice[]>('/api/notices');
  useEffect(() => { if (data && data.some(n => !n.read)) post('/api/notices/read').catch(() => {}); }, [data]);
  if (loading) return <Loading />;
  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <ErrorNote text={error} />
      {!data?.length ? <Empty text="Nothing new. Changes to your classes appear here." /> : data.map(n => (
        <Card key={n.id}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: n.read ? C.line : DOT[n.tone] }} />
            <View style={{ flex: 1 }}>
              <Text style={st.body}>{t(n.text)}</Text>
              <Text style={[st.muted, { marginTop: 4 }]}>{new Date(n.created_at).toLocaleString(lang === 'en' ? 'en-GB' : 'sq-AL', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
