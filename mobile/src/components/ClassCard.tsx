/* One class as every role sees it: when, what, who, and how full. What
   can be done with it is the caller's — passed in as children. */
import { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useT } from '@/lib/i18n';
import { longDate } from '@/lib/format';
import { C } from '@/lib/theme';
import { Card, Row, st } from './ui';

export type Klass = {
  id: string; typeId: string; date: string; start: string; end: string; capacity: number;
  instructorId?: string | null; cancelled?: boolean; blocked?: number;
};

export function ClassCard({ k, typeName, who, places, showDate, children, onPress, note }:
  { k: Klass; typeName: string; who?: string | null; places?: { left: number; capacity: number } | null;
    showDate?: boolean; children?: ReactNode; onPress?: () => void; note?: ReactNode }) {
  const { t, lang } = useT();
  return (
    <Card onPress={onPress} style={k.cancelled ? { opacity: 0.6 } : undefined}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 64 }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: C.ink }}>{k.start}</Text>
          <Text style={st.muted}>{k.end}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {showDate ? <Text style={[st.muted, { color: C.wine, fontWeight: '600' }]}>{longDate(k.date, lang, true)}</Text> : null}
          <Text style={[st.body, { fontWeight: '600' }]}>{t(typeName)}</Text>
          {who ? <Text style={st.muted}>{t('with %s', who)}</Text> : null}
          {k.cancelled ? <Text style={{ color: C.bad, marginTop: 2 }}>{t('Cancelled')}</Text>
            : places ? <Text style={[st.muted, places.left === 0 && { color: C.bad }]}>
                {places.left === 0 ? t('Full') : t('%s of %s places left', places.left, places.capacity)}</Text> : null}
          {note}
        </View>
      </Row>
      {children ? <View style={{ marginTop: 10 }}>{children}</View> : null}
    </Card>
  );
}
