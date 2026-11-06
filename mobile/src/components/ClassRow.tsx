import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { time } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { loc, type SessionDto } from '@/lib/types';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { Badge } from './ui';

/** One line of the timetable: time, class, instructor, places — as on the studio's board. Pass `now` to mark a class that is running. */
export function ClassRow({ s, onPress, showAvailability = true, now }: { s: SessionDto; onPress: () => void; showAvailability?: boolean; now?: number }) {
  const { t, lang } = useT();
  const running = now !== undefined && s.status !== 'CANCELLED' && Date.parse(s.startsAt) <= now && now < Date.parse(s.endsAt);
  const status = running ? (
    <Badge label={t('inProgress')} tone="success" />
  ) : s.myBookingId ? (
    <Badge label={t('booked')} tone="wine" />
  ) : s.myWaitlist ? (
    <Badge label={s.myWaitlist.status === 'OFFERED' ? t('OFFERED') : t('waitlisted')} tone="warning" />
  ) : s.status === 'CANCELLED' ? (
    <Badge label={t('CANCELLED')} tone="danger" />
  ) : showAvailability ? (
    <Text style={[styles.places, s.available === 0 && { color: colors.danger }]}>{s.available === 0 ? t('full') : s.available === 1 ? t('spot') : t('spots', { n: s.available })}</Text>
  ) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${time(s.startsAt)} ${s.classType.name} ${s.instructor?.name ?? ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.time}>
        <Text style={styles.hh}>{time(s.startsAt)}</Text>
        <Text style={styles.dur}>{t('min', { n: s.durationMin })}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {loc(lang, s.classType.name, s.classType.nameEn)}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {s.instructor?.name ?? '—'}
        </Text>
      </View>
      {status}
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: space.lg, marginBottom: space.md, ...shadow },
  // The time sits on a blush tile, like a little calendar stamp.
  time: { width: 58, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.blush, alignItems: 'center' },
  hh: { fontFamily: fonts.display, fontSize: 16, color: colors.wine },
  dur: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  places: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkSoft },
});
