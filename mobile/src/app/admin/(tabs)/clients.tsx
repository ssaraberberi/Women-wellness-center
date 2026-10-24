import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { Badge, Button, EmptyState, ErrorState, Field, Header, ListRow, Screen, SkeletonList } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { colors } from '@/theme';

interface ClientRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  remainingCredits: number;
  hasActiveMembership: boolean;
}

export default function AdminClients() {
  const router = useRouter();
  const { t } = useT();
  const [q, setQ] = useState('');
  const res = useQuery({ queryKey: ['admin-clients', q], queryFn: () => api<ClientRow[]>('GET', `/admin/clients?q=${encodeURIComponent(q.trim())}&limit=100`) });
  return (
    <Screen scroll={false}>
      <Header title={t('tabClients')} right={<Button small icon="user-plus" title={t('create')} onPress={() => router.push('/admin/client-new')} />} />
      <Field placeholder={t('search')} value={q} onChangeText={setQ} autoCapitalize="none" clearButtonMode="while-editing" />
      {res.isPending ? (
        <SkeletonList count={6} height={56} />
      ) : res.isError && !res.data ? (
        <ErrorState error={res.error} onRetry={() => void res.refetch()} />
      ) : (
        <FlatList
          data={res.data ?? []}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={res.isRefetching} onRefresh={() => void res.refetch()} tintColor={colors.wine} />}
          ListEmptyComponent={<EmptyState icon="users" title={t('noBookings')} />}
          renderItem={({ item }) => (
            <>
              <ListRow
                icon={item.hasActiveMembership ? 'star' : 'user'}
                label={item.name}
                value={item.status !== 'ACTIVE' ? t(item.status as 'INVITED') : item.hasActiveMembership ? t('creditsLeft', { n: item.remainingCredits }) : item.phone ?? ''}
                onPress={() => router.push({ pathname: '/admin/client/[id]', params: { id: item.id } })}
              />
              {item.status === 'DELETION_REQUESTED' ? <Badge label={t('DELETION_REQUESTED')} tone="danger" /> : null}
            </>
          )}
        />
      )}
    </Screen>
  );
}
