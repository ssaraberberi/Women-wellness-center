/* Who is coming to a class, with a tap for "came" and a tap for "did not".
   The instructor and the desk share it; each passes in its own write. */
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useT } from '@/lib/i18n';
import { C, R } from '@/lib/theme';
import { Card, Empty, ErrorNote, Row, st } from './ui';

export type RosterRow = { id: string; name: string; phone?: string | null; attendance: 'attended' | 'noshow' | null; status: string };

export function Roster({ rows, onMark, canMark }:
  { rows: RosterRow[]; onMark: (id: string, v: 'attended' | 'noshow' | null) => Promise<void>; canMark: boolean }) {
  const { t } = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!rows.length) return <Empty text="Nobody is booked yet." />;

  const mark = async (r: RosterRow, v: 'attended' | 'noshow') => {
    setBusy(r.id); setError(null);
    try { await onMark(r.id, r.attendance === v ? null : v); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };
  const chip = (r: RosterRow, v: 'attended' | 'noshow', label: string, on: string) => (
    <Pressable onPress={() => mark(r, v)} disabled={busy === r.id} accessibilityRole="button" accessibilityState={{ selected: r.attendance === v }}
      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.control, borderWidth: 1,
               borderColor: r.attendance === v ? on : C.line, backgroundColor: r.attendance === v ? on : C.white, opacity: busy === r.id ? 0.5 : 1 }}>
      <Text style={{ color: r.attendance === v ? C.white : C.ink, fontWeight: '600', fontSize: 14 }}>{t(label)}</Text>
    </Pressable>
  );

  return (
    <View>
      <ErrorNote text={error} />
      {rows.map(r => (
        <Card key={r.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={[st.body, { fontWeight: '600' }]}>{r.name}</Text>
              {r.phone ? <Text style={[st.muted, { color: C.wine }]} onPress={() => Linking.openURL('tel:' + r.phone!.replace(/\s/g, ''))}>{r.phone}</Text> : null}
              {r.status === 'waitlist' ? <Text style={st.muted}>{t('Waiting list')}</Text> : null}
            </View>
            {canMark && r.status === 'booked' ? (
              <Row>{chip(r, 'attended', 'Came', C.good)}{chip(r, 'noshow', 'No-show', C.bad)}</Row>
            ) : null}
          </Row>
        </Card>
      ))}
    </View>
  );
}
