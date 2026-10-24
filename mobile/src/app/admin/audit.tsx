import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, View } from 'react-native';
import { ErrorState, Header, Screen, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { whenShort } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, space } from '@/theme';

interface Log { id: string; action: string; entityType: string; entityId: string | null; actorId: string | null; data: unknown; createdAt: string }

/** Who changed what: payments, credits, staff, settings. */
export default function Audit() {
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['admin-audit'], queryFn: () => api<Log[]>('GET', '/admin/audit-logs?limit=200') });
  return (
    <Screen scroll={false}>
      <Header title={t('auditLog')} back />
      {q.isPending ? (
        <SkeletonList count={8} height={52} />
      ) : !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.wine} />}
          renderItem={({ item }) => (
            <View style={{ paddingVertical: space.sm, borderBottomWidth: 0.5, borderBottomColor: colors.line }}>
              <Text variant="bodyMedium">{item.action}</Text>
              <Text variant="caption">{whenShort(item.createdAt, lang)} · {item.entityType}{item.actorId ? ` · ${item.actorId.slice(0, 8)}` : ''}</Text>
              {item.data ? <Text variant="small" numberOfLines={2}>{JSON.stringify(item.data)}</Text> : null}
            </View>
          )}
        />
      )}
    </Screen>
  );
}
