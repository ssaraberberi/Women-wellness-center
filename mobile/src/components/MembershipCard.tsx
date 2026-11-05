import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { dateShort, lek } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { Badge, Text } from './ui';

/** The shape GET /me/memberships returns for each purchase (only what this card shows). */
export interface MembershipPurchase {
  id: string;
  name: string;
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING_PAYMENT';
  price: number;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  credits: { total: number; remaining: number } | null;
  order: { status: string; total: number } | null;
}

/** One package the client holds: classes left, what she paid, when it started and when it ends. */
export function MembershipCard({ p, onPress }: { p: MembershipPurchase; onPress: () => void }) {
  const { t, lang, tEnum } = useT();
  const left = p.credits?.remaining ?? 0;
  const total = p.credits?.total ?? 0;
  const [now] = useState(() => Date.now());
  const daysLeft = p.expiresAt ? Math.max(0, Math.ceil((new Date(p.expiresAt).getTime() - now) / 86_400_000)) : null;
  const paid = p.order?.total ?? p.price;
  const unpaid = p.status === 'PENDING_PAYMENT';

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.93, transform: [{ scale: 0.995 }] }]}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Badge label={tEnum(p.status)} tone={unpaid ? 'warning' : 'success'} />
          <Text style={styles.name}>{p.name}</Text>
          {daysLeft !== null && !unpaid ? (
            <Text variant="serifItalic" style={{ fontSize: 15 }}>{t('daysLeft', { n: daysLeft })} ✦</Text>
          ) : null}
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterNum}>{left}</Text>
          <Text style={styles.counterSub}>{t('ofClasses', { total })}</Text>
        </View>
      </View>

      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${total ? (left / total) * 100 : 0}%` }]} />
      </View>

      <View style={styles.grid}>
        <Cell label={unpaid ? t('toPay') : t('paid')} value={lek(paid)} />
        <View style={styles.divider} />
        <Cell label={t('started')} value={dateShort(p.startsAt ?? p.createdAt, lang)} />
        <View style={styles.divider} />
        <Cell label={t('ends')} value={p.expiresAt ? dateShort(p.expiresAt, lang) : '—'} />
      </View>

      <View style={styles.more}>
        <Text variant="small" style={{ color: colors.wine }}>{t('seeDetails')}</Text>
        <Feather name="arrow-right" size={14} color={colors.wine} />
      </View>
    </Pressable>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="eyebrow" style={{ fontSize: 9.5 }}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.xl, marginBottom: space.md, ...shadow },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  name: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, marginTop: space.sm, marginBottom: 2 },
  counter: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  counterNum: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.wine },
  counterSub: { fontFamily: fonts.medium, fontSize: 10, color: colors.inkSoft },
  progress: { height: 5, borderRadius: 3, backgroundColor: colors.blush, marginTop: space.lg, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: colors.wine },
  grid: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: colors.bg },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.oat },
  cellValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, marginTop: 4 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: space.md },
});
