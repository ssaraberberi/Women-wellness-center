import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { api } from '@/lib/api';
import { errorText, useT } from '@/lib/i18n';
import type { Difficulty } from '@/lib/types';
import { space } from '@/theme';
import { Badge, Button, Card, Chip, Field, Row, Text } from './ui';

interface ClassType {
  id: string;
  name: string;
  nameEn: string | null;
  description: string;
  format: string;
  difficulty: Difficulty;
  durationMin: number;
  defaultCapacity: number;
  creditsRequired: number;
  active: boolean;
}
const LEVELS: Difficulty[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'];
const blank = { name: '', nameEn: '', description: '', format: 'REFORMER', difficulty: 'ALL_LEVELS' as Difficulty, durationMin: '50', defaultCapacity: '8', creditsRequired: '1' };

/** The kinds of class the timetable is built from: Reformer Flow, Mat… */
export function ClassTypesEditor() {
  const qc = useQueryClient();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['admin-class-types'], queryFn: () => api<ClassType[]>('GET', '/admin/class-types') });
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [f, setF] = useState(blank);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name.trim(),
        nameEn: f.nameEn.trim() || null,
        description: f.description,
        format: f.format.trim().toUpperCase() || 'REFORMER',
        difficulty: f.difficulty,
        durationMin: Number(f.durationMin || 50),
        defaultCapacity: Number(f.defaultCapacity || 8),
        creditsRequired: Number(f.creditsRequired || 0),
      };
      return editing === 'new' ? api('POST', '/admin/class-types', { body }) : api('PATCH', `/admin/class-types/${editing}`, { body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-class-types'] });
      setEditing(null);
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const toggle = useMutation({
    mutationFn: (c: ClassType) => api('PATCH', `/admin/class-types/${c.id}`, { body: { active: !c.active } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-class-types'] }),
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const n = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v.replace(/\D/g, '') });

  const form = (
    <Card style={{ marginBottom: space.sm }}>
      <Field label={t('name')} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
      <Field label={`${t('name')} (EN)`} value={f.nameEn} onChangeText={(v) => setF({ ...f, nameEn: v })} />
      <Field label={t('description')} value={f.description} onChangeText={(v) => setF({ ...f, description: v })} multiline />
      <Row style={{ marginBottom: space.sm }}>
        {['REFORMER', 'MAT'].map((x) => <Chip key={x} label={x} active={f.format === x} onPress={() => setF({ ...f, format: x })} />)}
      </Row>
      <Row style={{ flexWrap: 'wrap', marginBottom: space.sm }}>
        {LEVELS.map((d) => <Chip key={d} label={t(d)} active={f.difficulty === d} onPress={() => setF({ ...f, difficulty: d })} />)}
      </Row>
      <Row>
        <Field label="min" value={f.durationMin} onChangeText={n('durationMin')} keyboardType="number-pad" style={{ width: 80 }} />
        <Field label={t('capacity')} value={f.defaultCapacity} onChangeText={n('defaultCapacity')} keyboardType="number-pad" style={{ width: 90 }} />
        <Field label={t('credits')} value={f.creditsRequired} onChangeText={n('creditsRequired')} keyboardType="number-pad" style={{ width: 80 }} />
      </Row>
      <Row>
        <Button style={{ flex: 1 }} title={t('save')} onPress={() => save.mutate()} loading={save.isPending} disabled={!f.name.trim()} />
        <Button variant="ghost" title={t('cancel')} onPress={() => setEditing(null)} />
      </Row>
    </Card>
  );

  return (
    <View>
      {(q.data ?? []).map((c) =>
        editing === c.id ? (
          <View key={c.id}>{form}</View>
        ) : (
          <Row key={c.id} style={{ paddingVertical: 6, opacity: c.active ? 1 : 0.55 }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{c.name}</Text>
              <Text variant="small">{c.format} · {t(c.difficulty)} · {c.durationMin} min · {c.defaultCapacity} · {t('creditCost', { n: c.creditsRequired })}</Text>
            </View>
            {!c.active ? <Badge label={t('inactive')} tone="warning" /> : null}
            <Button
              small
              variant="ghost"
              title={t('edit')}
              onPress={() => {
                setEditing(c.id);
                setF({ name: c.name, nameEn: c.nameEn ?? '', description: c.description, format: c.format, difficulty: c.difficulty, durationMin: String(c.durationMin), defaultCapacity: String(c.defaultCapacity), creditsRequired: String(c.creditsRequired) });
              }}
            />
            <Button small variant="ghost" title={c.active ? t('deactivate') : t('activate')} onPress={() => toggle.mutate(c)} />
          </Row>
        ),
      )}
      {editing === 'new' ? form : <Button small variant="secondary" icon="plus" title={t('create')} onPress={() => { setEditing('new'); setF(blank); }} />}
    </View>
  );
}
