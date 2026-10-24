import Feather from '@expo/vector-icons/Feather';
import { useMemo } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, dayNum, dayShort, isoWeekday, monthTitle, todayISO } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, fonts, radius, space } from '@/theme';

/**
 * A week at a time, Monday first, swiped with the arrows (or by tapping past
 * the edge). Days before today are shown but not selectable.
 */
export function DateStrip({ value, onChange, maxDate }: { value: string; onChange: (iso: string) => void; maxDate?: string }) {
  const { lang, t } = useT();
  const today = todayISO();
  const monday = addDays(value, 1 - isoWeekday(value));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const canBack = addDays(monday, -1) >= today;
  const canForward = !maxDate || addDays(monday, 7) <= maxDate;
  const prevWeek = () => canBack && onChange(addDays(monday, -7) < today ? today : addDays(monday, -7));
  const nextWeek = () => canForward && onChange(addDays(monday, 7));
  // Swipe the row sideways to change week.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_, g) => (g.dx < -40 ? nextWeek() : g.dx > 40 ? prevWeek() : undefined),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monday, canBack, canForward],
  );

  return (
    <View>
      <View style={styles.top}>
        <Text style={styles.month}>{monthTitle(value, lang)}</Text>
        <View style={{ flexDirection: 'row' }}>
          <Pressable accessibilityLabel={t('back')} disabled={!canBack} onPress={prevWeek} style={[styles.arrow, !canBack && { opacity: 0.3 }]}>
            <Feather name="chevron-left" size={20} color={colors.ink} />
          </Pressable>
          <Pressable accessibilityLabel="next week" disabled={!canForward} onPress={nextWeek} style={[styles.arrow, !canForward && { opacity: 0.3 }]}>
            <Feather name="chevron-right" size={20} color={colors.ink} />
          </Pressable>
        </View>
      </View>
      <View style={styles.row} {...pan.panHandlers}>
        {days.map((d) => {
          const selected = d === value;
          const disabled = d < today || (!!maxDate && d > maxDate);
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={`${dayShort(d, lang)} ${dayNum(d)}`}
              disabled={disabled}
              onPress={() => onChange(d)}
              style={[styles.day, selected && styles.daySelected, disabled && { opacity: 0.35 }]}
            >
              <Text style={[styles.dow, selected && { color: colors.wineSoft }]}>{dayShort(d, lang)}</Text>
              <Text style={[styles.num, selected && { color: colors.white }]}>{dayNum(d)}</Text>
              {d === today && !selected ? <View style={styles.dot} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  month: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkSoft },
  arrow: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 44, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 4 },
  daySelected: { backgroundColor: colors.wine },
  dow: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
  num: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  dot: { position: 'absolute', bottom: 7, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.wine },
});
