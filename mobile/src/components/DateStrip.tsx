import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { LayoutAnimation, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, dayNum, dayShort, isoWeekday, monthTitle, todayISO } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, fonts, radius, shadow, space } from '@/theme';

const firstOfMonth = (iso: string) => `${iso.slice(0, 8)}01`;
const shiftMonth = (first: string, n: number) => {
  const y = +first.slice(0, 4);
  const m = +first.slice(5, 7) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
};

/**
 * A week at a time, Monday first, changed with the arrows or a swipe. Tap the
 * month to open the whole month and pick any day; it folds back to the week.
 * Days before today (and after `maxDate`) are shown but not selectable.
 */
export function DateStrip({ value, onChange, maxDate }: { value: string; onChange: (iso: string) => void; maxDate?: string }) {
  const { lang, t } = useT();
  const today = todayISO();
  const [open, setOpen] = useState(false);
  // The month on show when open; it can differ from the selected day's month while browsing.
  const [month, setMonth] = useState(firstOfMonth(value));

  const monday = addDays(value, 1 - isoWeekday(value));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const canBackWeek = addDays(monday, -1) >= today;
  const canForwardWeek = !maxDate || addDays(monday, 7) <= maxDate;
  const prevWeek = () => canBackWeek && onChange(addDays(monday, -7) < today ? today : addDays(monday, -7));
  const nextWeek = () => canForwardWeek && onChange(addDays(monday, 7));

  const canBackMonth = month > firstOfMonth(today);
  const canForwardMonth = !maxDate || shiftMonth(month, 1) <= maxDate;
  const prevMonth = () => canBackMonth && setMonth(shiftMonth(month, -1));
  const nextMonth = () => canForwardMonth && setMonth(shiftMonth(month, 1));

  const canBack = open ? canBackMonth : canBackWeek;
  const canForward = open ? canForwardMonth : canForwardWeek;
  const back = open ? prevMonth : prevWeek;
  const forward = open ? nextMonth : nextWeek;

  // Swipe sideways: a week when folded, a month when open.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_, g) => (g.dx < -40 ? forward() : g.dx > 40 ? back() : undefined),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, monday, month, canBack, canForward],
  );

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!open) setMonth(firstOfMonth(value));
    setOpen((o) => !o);
  };
  const pick = (d: string) => {
    onChange(d);
    if (open) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOpen(false);
    }
  };

  // Whole weeks covering the month, Monday first.
  const grid = useMemo(() => {
    const start = addDays(month, 1 - isoWeekday(month));
    const end = addDays(shiftMonth(month, 1), -1);
    const cells: string[] = [];
    for (let d = start; d <= end || cells.length % 7; d = addDays(d, 1)) cells.push(d);
    return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  }, [month]);

  const dayCell = (d: string, compact: boolean) => {
    const selected = d === value;
    const disabled = d < today || (!!maxDate && d > maxDate);
    const outside = compact && d.slice(0, 7) !== month.slice(0, 7);
    return (
      <Pressable
        key={d}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={`${dayShort(d, lang)} ${dayNum(d)}`}
        disabled={disabled}
        onPress={() => pick(d)}
        style={[compact ? styles.cell : styles.day, selected && styles.daySelected, disabled && { opacity: 0.3 }, outside && !selected && { opacity: 0.25 }]}
      >
        {!compact ? <Text style={[styles.dow, selected && { color: colors.wineSoft }]}>{dayShort(d, lang)}</Text> : null}
        <Text style={[compact ? styles.cellNum : styles.num, selected && { color: colors.white }]}>{dayNum(d)}</Text>
        {d === today && !selected ? <Text style={styles.today}>✦</Text> : null}
      </Pressable>
    );
  };

  return (
    <View>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel={open ? t('showWeek') : t('showMonth')} onPress={toggle} hitSlop={8} style={styles.monthBtn}>
          <Text style={styles.month}>{monthTitle(open ? month : value, lang)}</Text>
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.wine} />
        </Pressable>
        <View style={{ flexDirection: 'row' }}>
          <Pressable accessibilityLabel={t('back')} disabled={!canBack} onPress={back} style={[styles.arrow, !canBack && { opacity: 0.3 }]}>
            <Feather name="chevron-left" size={20} color={colors.ink} />
          </Pressable>
          <Pressable accessibilityLabel={t('next')} disabled={!canForward} onPress={forward} style={[styles.arrow, !canForward && { opacity: 0.3 }]}>
            <Feather name="chevron-right" size={20} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      {open ? (
        <View style={styles.monthBox} {...pan.panHandlers}>
          <View style={styles.weekRow}>
            {grid[0].map((d) => (
              <Text key={d} style={[styles.dow, styles.head]}>{dayShort(d, lang)}</Text>
            ))}
          </View>
          {grid.map((week) => (
            <View key={week[0]} style={styles.weekRow}>
              {week.map((d) => dayCell(d, true))}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.row} {...pan.panHandlers}>
          {days.map((d) => dayCell(d, false))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  monthBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  month: { fontFamily: fonts.displayItalic, fontSize: 18, color: colors.ink },
  arrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, marginLeft: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.xl, padding: 6, ...shadow },
  day: { width: 42, height: 66, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', gap: 3 },
  daySelected: { backgroundColor: colors.wine },
  dow: { fontFamily: fonts.medium, fontSize: 10, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase' },
  num: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  today: { position: 'absolute', bottom: 3, fontSize: 8, color: colors.wine },
  monthBox: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingVertical: space.md, paddingHorizontal: 6, gap: 4, ...shadow },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  head: { width: 42, textAlign: 'center', marginBottom: 4 },
  cell: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cellNum: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
});
