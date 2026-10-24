import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { colors, space } from '@/theme';
import { Field, Text } from './ui';

export interface ClientLite {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  remainingCredits: number;
}

/** Search the client list by name, email or phone and pick one. */
export function ClientPicker({ onPick }: { onPick: (c: ClientLite) => void }) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const res = useQuery({ queryKey: ['admin-clients', q], queryFn: () => api<ClientLite[]>('GET', `/admin/clients?q=${encodeURIComponent(q)}&limit=20`), enabled: q.trim().length >= 2 });
  return (
    <View>
      <Field placeholder={t('search')} value={q} onChangeText={setQ} autoCapitalize="none" />
      {(res.data ?? []).map((c) => (
        <Pressable key={c.id} onPress={() => onPick(c)} style={{ paddingVertical: space.md, borderBottomWidth: 0.5, borderBottomColor: colors.line }}>
          <Text variant="bodyMedium">{c.name}</Text>
          <Text variant="small">{c.phone ?? c.email} · {t('creditsLeft', { n: c.remainingCredits })}</Text>
        </Pressable>
      ))}
    </View>
  );
}
