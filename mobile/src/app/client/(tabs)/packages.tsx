import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Badge, EmptyState, ErrorState, Gap, IconButton, Row, Screen, Segmented, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { SPA_ENABLED } from '@/lib/features';
import { lek } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { photo } from '@/lib/images';
import { loc, type Product } from '@/lib/types';
import { colors, radius, space } from '@/theme';

type Tab = 'pilates' | 'spa' | 'combo';
const tabOf = (p: Product): Tab => (p.classCredits > 0 && p.spaItems.length ? 'combo' : p.spaItems.length ? 'spa' : 'pilates');

export default function Packages() {
  const router = useRouter();
  const { t, lang } = useT();
  const [tab, setTab] = useState<Tab>('pilates');
  const q = useQuery({ queryKey: ['products'], queryFn: () => api<Product[]>('GET', '/products') });
  const list = (q.data ?? []).filter((p) => tabOf(p) === tab);

  return (
    <Screen scroll={false}>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.md }}>
        <Text variant="title">{t('packages')}</Text>
        <IconButton name="credit-card" label={t('myMemberships')} onPress={() => router.push('/client/memberships')} />
      </Row>
      <Gap h={space.md} />
      {/* Without SPA only the Pilates packages are on sale, so there is nothing to switch between. */}
      {SPA_ENABLED ? (
        <>
          <Segmented options={[{ value: 'pilates', label: t('pilates') }, { value: 'spa', label: t('spa') }, { value: 'combo', label: t('combos') }]} value={tab} onChange={setTab} />
          <Gap h={space.md} />
        </>
      ) : null}
      {q.isPending ? (
        <SkeletonList count={3} height={130} />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.wine} />}
          ListEmptyComponent={<EmptyState icon="package" title={t('noBookings')} />}
          renderItem={({ item: p }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/client/package/[id]', params: { id: p.id } })} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
              <Image source={photo(p.imageKey)} style={styles.img} contentFit="cover" />
              <View style={styles.shade} />
              <View style={{ flex: 1, padding: space.lg, justifyContent: 'center' }}>
                <Text variant="title" style={{ fontSize: 20 }}>{loc(lang, p.name, p.nameEn)}</Text>
                <Text variant="small" style={{ color: colors.inkSoft }}>
                  {p.sessionsPerWeekHint ? t('perWeek', { n: p.sessionsPerWeekHint }) : loc(lang, p.description, p.descriptionEn)}
                </Text>
                <Row style={{ marginTop: space.sm }}>
                  {p.originalPrice ? <Text variant="small" style={{ textDecorationLine: 'line-through' }}>{lek(p.originalPrice)}</Text> : null}
                  <Text variant="heading">{lek(p.price)}</Text>
                  {p.firstTimeOnly ? <Badge label="1×" tone="wine" /> : null}
                </Row>
              </View>
              <Feather name="chevron-right" size={20} color={colors.inkSoft} style={{ marginRight: space.lg }} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', minHeight: 140, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: space.lg },
  img: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '48%' },
  shade: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '66%', backgroundColor: colors.surface, opacity: 0.92 },
});
