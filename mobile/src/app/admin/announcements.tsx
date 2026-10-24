import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Header, Row, Screen, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { dateShort } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { space } from '@/theme';

interface Ann {
  id: string;
  title: string;
  body: string;
  kind: 'NEWS' | 'OFFER';
  active: boolean;
  startsAt: string;
}

/** What the home screen says under "From the studio" and "Offers". */
export default function Announcements() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['admin-ann'], queryFn: () => api<Ann[]>('GET', '/admin/announcements') });
  const [f, setF] = useState({ title: '', titleEn: '', body: '', bodyEn: '', kind: 'NEWS' as 'NEWS' | 'OFFER' });
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-ann'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  return (
    <Screen>
      <Header title={t('announcements')} back />
      <Card style={{ marginBottom: space.lg }}>
        <Row style={{ marginBottom: space.sm }}>
          <Chip label={t('NEWS')} active={f.kind === 'NEWS'} onPress={() => setF({ ...f, kind: 'NEWS' })} />
          <Chip label={t('OFFER')} active={f.kind === 'OFFER'} onPress={() => setF({ ...f, kind: 'OFFER' })} />
        </Row>
        <Field label={t('title')} value={f.title} onChangeText={(v) => setF({ ...f, title: v })} />
        <Field label={`${t('title')} (EN)`} value={f.titleEn} onChangeText={(v) => setF({ ...f, titleEn: v })} />
        <Field label={t('body')} value={f.body} onChangeText={(v) => setF({ ...f, body: v })} multiline />
        <Field label={`${t('body')} (EN)`} value={f.bodyEn} onChangeText={(v) => setF({ ...f, bodyEn: v })} multiline />
        <Button
          title={t('create')}
          disabled={!f.title.trim() || !f.body.trim()}
          loading={run.isPending}
          onPress={() => run.mutate(() => api('POST', '/admin/announcements', { body: { ...f, titleEn: f.titleEn || null, bodyEn: f.bodyEn || null } }).then(() => setF({ title: '', titleEn: '', body: '', bodyEn: '', kind: f.kind })))}
        />
      </Card>
      {q.isPending ? (
        <SkeletonList count={3} />
      ) : (
        (q.data ?? []).map((a) => (
          <Card key={a.id} style={{ marginBottom: space.sm, opacity: a.active ? 1 : 0.55 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Row><Badge label={t(a.kind)} tone={a.kind === 'OFFER' ? 'wine' : 'neutral'} /><Text variant="caption">{dateShort(a.startsAt, lang)}</Text></Row>
                <Text variant="heading">{a.title}</Text>
                <Text variant="small">{a.body}</Text>
              </View>
              <Button small variant="secondary" title={a.active ? t('deactivate') : t('activate')} onPress={() => run.mutate(() => api('PATCH', `/admin/announcements/${a.id}`, { body: { active: !a.active } }))} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
