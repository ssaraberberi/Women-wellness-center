import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Gap, Header, Row, Screen, Section, Segmented, SkeletonList, Text, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import { lek } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import type { Treatment } from '@/lib/types';
import { space } from '@/theme';

const CATS = ['RELAX', 'DEEP_TISSUE', 'LYMPHATIC', 'SPORTS', 'MADERO', 'BACK_NECK'];
const blank = { name: '', nameEn: '', category: 'RELAX', description: '', benefits: '', durationMin: '60', bufferMin: '10', price: '', clientCanChooseTherapist: true, active: true, imageKey: 'massage-hands' };

/** Treatments and rooms. Therapist qualifications and hours are on each therapist (Staff tab). */
export default function SpaManage() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const [tab, setTab] = useState<'treatments' | 'rooms'>('treatments');
  const tq = useQuery({ queryKey: ['admin-treatments'], queryFn: () => api<Treatment[]>('GET', '/admin/spa/treatments') });
  const rq = useQuery({ queryKey: ['admin-rooms'], queryFn: () => api<{ id: string; name: string; active: boolean }[]>('GET', '/admin/spa/rooms') });
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [f, setF] = useState(blank);
  const [room, setRoom] = useState('');
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-treatments'] });
      void qc.invalidateQueries({ queryKey: ['admin-rooms'] });
      void qc.invalidateQueries({ queryKey: ['treatments'] });
      setEditing(null);
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const startEdit = (x: Treatment | null) => {
    setEditing(x ? x.id : 'new');
    setF(
      x
        ? { name: x.name, nameEn: x.nameEn ?? '', category: x.category, description: x.description, benefits: x.benefits, durationMin: String(x.durationMin), bufferMin: String((x as any).bufferMin ?? 10), price: String(x.price), clientCanChooseTherapist: x.clientCanChooseTherapist, active: x.active, imageKey: x.imageKey ?? '' }
        : blank,
    );
  };
  const save = () => {
    const body = { ...f, nameEn: f.nameEn || null, durationMin: Number(f.durationMin), bufferMin: Number(f.bufferMin), price: Number(f.price), imageKey: f.imageKey || null };
    run.mutate(() => (editing === 'new' ? api('POST', '/admin/spa/treatments', { body }) : api('PATCH', `/admin/spa/treatments/${editing}`, { body })));
  };
  const n = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v.replace(/\D/g, '') });

  const form = (
    <Card style={{ marginBottom: space.md }}>
      <Field label={t('name')} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
      <Field label={`${t('name')} (EN)`} value={f.nameEn} onChangeText={(v) => setF({ ...f, nameEn: v })} />
      <Text variant="label">{t('category')}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        {CATS.map((c) => <Chip key={c} label={c} active={f.category === c} onPress={() => setF({ ...f, category: c })} />)}
      </Row>
      <Row>
        <Field label={t('duration')} value={f.durationMin} onChangeText={n('durationMin')} keyboardType="number-pad" style={{ width: 100 }} />
        <Field label="Buffer" value={f.bufferMin} onChangeText={n('bufferMin')} keyboardType="number-pad" style={{ width: 80 }} />
        <Field label={t('price')} value={f.price} onChangeText={n('price')} keyboardType="number-pad" style={{ width: 110 }} />
      </Row>
      <Field label={t('description')} value={f.description} onChangeText={(v) => setF({ ...f, description: v })} multiline />
      <Field label={t('benefits')} value={f.benefits} onChangeText={(v) => setF({ ...f, benefits: v })} multiline />
      <ToggleRow label={t('therapist')} hint={lang === 'sq' ? 'Klientja mund të zgjedhë terapisten' : 'Client may choose the therapist'} value={f.clientCanChooseTherapist} onChange={(v) => setF({ ...f, clientCanChooseTherapist: v })} />
      <ToggleRow label={t('active')} value={f.active} onChange={(v) => setF({ ...f, active: v })} />
      <Gap h={space.sm} />
      <Row>
        <Button style={{ flex: 1 }} title={t('save')} onPress={save} loading={run.isPending} disabled={!f.name || !f.price} />
        <Button variant="ghost" title={t('cancel')} onPress={() => setEditing(null)} />
      </Row>
    </Card>
  );

  return (
    <Screen>
      <Header title={t('spaManagement')} back />
      <Segmented options={[{ value: 'treatments', label: t('treatments') }, { value: 'rooms', label: t('rooms') }]} value={tab} onChange={setTab} />
      <Gap h={space.md} />
      {tab === 'treatments' ? (
        <>
          {editing === 'new' ? form : <Button variant="secondary" icon="plus" title={t('create')} onPress={() => startEdit(null)} />}
          <Gap h={space.md} />
          {tq.isPending ? (
            <SkeletonList count={5} />
          ) : (
            (tq.data ?? []).map((x) =>
              editing === x.id ? (
                <View key={x.id}>{form}</View>
              ) : (
                <Card key={x.id} onPress={() => startEdit(x)} style={{ marginBottom: space.sm, opacity: x.active ? 1 : 0.6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="heading">{x.name}</Text>
                      <Text variant="small">{x.category} · {t('min', { n: x.durationMin })}</Text>
                    </View>
                    <Text variant="heading">{lek(x.price)}</Text>
                    {!x.active ? <Badge label={t('inactive')} tone="warning" /> : null}
                  </Row>
                </Card>
              ),
            )
          )}
        </>
      ) : (
        <Section title={t('rooms')}>
          {(rq.data ?? []).map((r) => (
            <Row key={r.id} style={{ paddingVertical: 6, justifyContent: 'space-between' }}>
              <Text variant="bodyMedium" style={{ opacity: r.active ? 1 : 0.5 }}>{r.name}</Text>
              <Button small variant="secondary" title={r.active ? t('deactivate') : t('activate')} onPress={() => run.mutate(() => api('PATCH', `/admin/spa/rooms/${r.id}`, { body: { active: !r.active } }))} />
            </Row>
          ))}
          <Row style={{ marginTop: space.md }}>
            <Field value={room} onChangeText={setRoom} placeholder={t('room')} style={{ width: 200 }} />
            <Button small icon="plus" title={t('create')} disabled={!room.trim()} onPress={() => run.mutate(() => api('POST', '/admin/spa/rooms', { body: { name: room.trim() } }).then(() => setRoom('')))} style={{ marginBottom: space.md }} />
          </Row>
        </Section>
      )}
    </Screen>
  );
}
