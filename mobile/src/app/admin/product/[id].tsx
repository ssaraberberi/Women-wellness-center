import Feather from '@expo/vector-icons/Feather';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Button, Card, Chip, Field, Gap, Header, Notice, Row, Screen, Section, Text, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useT } from '@/lib/i18n';
import type { Product, Treatment } from '@/lib/types';
import { colors, space } from '@/theme';

const KINDS = ['SINGLE', 'PACKAGE', 'TRIAL', 'PROMO', 'DUO', 'COMBO', 'SPA'] as const;
const CATS = ['RELAX', 'DEEP_TISSUE', 'LYMPHATIC', 'SPORTS', 'MADERO', 'BACK_NECK'];
type SpaItem = { treatmentId: string | null; category: string | null; quantity: number };

/** Create or edit a package. Purchases already made keep the terms they were sold with. */
export default function ProductEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang, tEnum } = useT();
  const all = useQuery({ queryKey: ['admin-products'], queryFn: () => api<Product[]>('GET', '/admin/products'), enabled: !isNew });
  const treatments = useQuery({ queryKey: ['admin-treatments'], queryFn: () => api<Treatment[]>('GET', '/admin/spa/treatments') });
  const p = all.data?.find((x) => x.id === id);
  const [f, setF] = useState({ kind: 'PACKAGE' as (typeof KINDS)[number], name: '', nameEn: '', description: '', price: '', originalPrice: '', classCredits: '0', validityDays: '30', sessionsPerWeekHint: '', terms: '', firstTimeOnly: false, active: true, imageKey: '' });
  const [items, setItems] = useState<SpaItem[]>([]);
  const [newItem, setNewItem] = useState<SpaItem>({ treatmentId: null, category: 'RELAX', quantity: 1 });

  // Seed the form once the package arrives (and again only if it changes).
  const [seeded, setSeeded] = useState<Product | undefined>(undefined);
  if (p && seeded !== p) {
    setSeeded(p);
    setF({
      kind: p.kind,
      name: p.name,
      nameEn: p.nameEn ?? '',
      description: p.description,
      price: String(p.price),
      originalPrice: p.originalPrice ? String(p.originalPrice) : '',
      classCredits: String(p.classCredits),
      validityDays: String(p.validityDays),
      sessionsPerWeekHint: p.sessionsPerWeekHint ? String(p.sessionsPerWeekHint) : '',
      terms: p.terms,
      firstTimeOnly: p.firstTimeOnly,
      active: p.active,
      imageKey: p.imageKey ?? '',
    });
    setItems(p.spaItems.map((s) => ({ treatmentId: s.treatment?.id ?? null, category: s.category, quantity: s.quantity })));
  }

  const num = (s: string) => Number(s.replace(/\D/g, '') || 0);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        kind: f.kind,
        name: f.name.trim(),
        nameEn: f.nameEn.trim() || null,
        description: f.description,
        price: num(f.price),
        originalPrice: f.originalPrice ? num(f.originalPrice) : null,
        classCredits: num(f.classCredits),
        validityDays: num(f.validityDays),
        sessionsPerWeekHint: f.sessionsPerWeekHint ? num(f.sessionsPerWeekHint) : null,
        terms: f.terms,
        firstTimeOnly: f.firstTimeOnly,
        active: f.active,
        imageKey: f.imageKey || null,
        spaItems: items,
      };
      return isNew ? api('POST', '/admin/products', { body }) : api('PATCH', `/admin/products/${id}`, { body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-products'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      router.back();
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const tName = (tid: string | null) => treatments.data?.find((x) => x.id === tid)?.name;

  return (
    <Screen footer={<Button title={t('save')} onPress={() => save.mutate()} loading={save.isPending} disabled={!f.name.trim() || !f.price} />}>
      <Header title={isNew ? t('create') : f.name} back />
      {!isNew ? <Notice text={lang === 'sq' ? 'Ndryshimet vlejnë për blerjet e reja. Blerjet ekzistuese ruajnë kushtet e tyre.' : 'Changes apply to new purchases. Existing purchases keep their terms.'} /> : null}
      <Gap h={space.md} />
      <Text variant="label">{t('kind')}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        {KINDS.map((k) => <Chip key={k} label={tEnum(k)} active={f.kind === k} onPress={() => setF({ ...f, kind: k })} />)}
      </Row>
      <Field label={t('name')} value={f.name} onChangeText={set('name')} />
      <Field label={`${t('name')} (EN)`} value={f.nameEn} onChangeText={set('nameEn')} />
      <Field label={t('description')} value={f.description} onChangeText={set('description')} multiline />
      <Row>
        <Field label={t('price')} value={f.price} onChangeText={set('price')} keyboardType="number-pad" style={{ width: 150 }} />
        <Field label={t('originalPrice')} value={f.originalPrice} onChangeText={set('originalPrice')} keyboardType="number-pad" style={{ width: 150 }} />
      </Row>
      <Row>
        <Field label={t('credits')} value={f.classCredits} onChangeText={set('classCredits')} keyboardType="number-pad" style={{ width: 100 }} />
        <Field label={t('validity')} value={f.validityDays} onChangeText={set('validityDays')} keyboardType="number-pad" style={{ width: 100 }} />
        <Field label="× / week" value={f.sessionsPerWeekHint} onChangeText={set('sessionsPerWeekHint')} keyboardType="number-pad" style={{ width: 90 }} />
      </Row>
      <Field label={t('termsTitle')} value={f.terms} onChangeText={set('terms')} multiline />
      <ToggleRow label={t('firstTimeOnly')} value={f.firstTimeOnly} onChange={(v) => setF({ ...f, firstTimeOnly: v })} />
      <ToggleRow label={t('active')} value={f.active} onChange={(v) => setF({ ...f, active: v })} />

      <Section title={t('spaIncluded')}>
        {items.map((it, i) => (
          <Row key={i} style={{ paddingVertical: 6 }}>
            <Text variant="bodyMedium" style={{ flex: 1 }}>{it.quantity} × {it.treatmentId ? tName(it.treatmentId) : it.category}</Text>
            <Pressable onPress={() => setItems(items.filter((_, j) => j !== i))} hitSlop={10} accessibilityLabel={t('remove')}>
              <Feather name="x" size={18} color={colors.danger} />
            </Pressable>
          </Row>
        ))}
        <Card style={{ marginTop: space.sm }}>
          <Text variant="label">{t('category')}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {CATS.map((c) => <Chip key={c} label={c} active={!newItem.treatmentId && newItem.category === c} onPress={() => setNewItem({ ...newItem, category: c, treatmentId: null })} />)}
          </Row>
          <Text variant="label">{t('treatments')}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {(treatments.data ?? []).map((x) => <Chip key={x.id} label={`${x.name} ${x.durationMin}'`} active={newItem.treatmentId === x.id} onPress={() => setNewItem({ ...newItem, treatmentId: x.id, category: null })} />)}
          </Row>
          <Row>
            <Field value={String(newItem.quantity)} onChangeText={(v) => setNewItem({ ...newItem, quantity: Math.max(1, num(v)) })} keyboardType="number-pad" style={{ width: 70 }} />
            <Button small variant="secondary" icon="plus" title={t('addSlot')} onPress={() => setItems([...items, newItem])} style={{ marginBottom: space.md }} />
          </Row>
        </Card>
      </Section>
    </Screen>
  );
}
