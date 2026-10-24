import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';
import { time } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius, space } from '@/theme';
import { Badge, Text } from './ui';

export interface StaffItem {
  kind: 'class' | 'spa';
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  capacity?: number;
  booked?: number;
  room?: string | null;
  client?: string;
  durationMin?: number;
}

export interface Schedule {
  sessions: StaffItem[];
  appointments: StaffItem[];
  closures: { date: string; reason: string | null }[];
  timeOff: { startsAt: string; endsAt: string; reason: string | null }[];
}

export const mergeAgenda = (s: Schedule) => [...s.sessions, ...s.appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

/** A session or appointment in a staff member's day. */
export function AgendaItem({ item, onPress }: { item: StaffItem; onPress: () => void }) {
  const { t } = useT();
  const cancelled = item.status === 'CANCELLED';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }, cancelled && { opacity: 0.55 }]}>
      <View style={[styles.bar, { backgroundColor: item.kind === 'class' ? colors.wine : colors.success }]} />
      <View style={{ width: 54 }}>
        <Text variant="heading">{time(item.startsAt)}</Text>
        <Text variant="caption">{time(item.endsAt)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="heading" numberOfLines={1}>{item.title}</Text>
        <Text variant="small" numberOfLines={1}>
          {item.kind === 'class' ? `${item.booked}/${item.capacity} · ${item.room ?? 'Studio'}` : `${item.client} · ${item.room}`}
        </Text>
      </View>
      {cancelled ? <Badge label={t('CANCELLED')} tone="danger" /> : item.status === 'COMPLETED' || item.status === 'NO_SHOW' ? <Badge label={t(item.status)} /> : null}
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 14, paddingRight: space.lg, marginBottom: space.sm, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  bar: { width: 4, alignSelf: 'stretch' },
});
