import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, LinearTransition, useAnimatedStyle, useSharedValue, withSpring, ZoomIn } from 'react-native-reanimated';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
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

type DayMark = { date: string; classes: number; booked: number; mine: number };

// One soft spring for everything that moves, so the calendar feels like one piece.
const SPRING = { damping: 18, stiffness: 190, mass: 0.8 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A real month calendar, Monday first: the whole month at a glance, changed
 * with the arrows or a swipe, folding to a single week when the list below
 * needs the room. With `marks`, busy days are marked — for a client the days
 * she booked (and the days with classes), for staff and admins the days with
 * classes and how many places are taken.
 * Days before today (and after `maxDate`) are shown but not selectable.
 */
export function DateStrip({ value, onChange, maxDate, marks = false, allowPast = false }: { value: string; onChange: (iso: string) => void; maxDate?: string; marks?: boolean; allowPast?: boolean }) {
  const { lang, t } = useT();
  const role = useAuth((s) => s.me?.role);
  const today = todayISO();
  const minDate = allowPast ? undefined : today;
  const [open, setOpen] = useState(true);
  const [month, setMonth] = useState(firstOfMonth(value));
  // Which way the last page turn went: the new page glides in from that side.
  const [dir, setDir] = useState<-1 | 0 | 1>(0);
  const dragX = useSharedValue(0);
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.get() }] }));
  const [seen, setSeen] = useState(value);
  // Picking a day elsewhere (e.g. "today") brings its month into view.
  if (seen !== value) {
    setSeen(value);
    if (firstOfMonth(value) !== month) setMonth(firstOfMonth(value));
  }

  // Whole weeks covering the month.
  const grid = useMemo(() => {
    const start = addDays(month, 1 - isoWeekday(month));
    const end = addDays(shiftMonth(month, 1), -1);
    const cells: string[] = [];
    for (let d = start; d <= end || cells.length % 7; d = addDays(d, 1)) cells.push(d);
    return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  }, [month]);
  const monday = addDays(value, 1 - isoWeekday(value));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const from = open ? grid[0][0] : week[0];
  const to = open ? grid[grid.length - 1][6] : week[6];

  const q = useQuery({
    queryKey: ['calendar-days', from, to],
    queryFn: () => api<DayMark[]>('GET', `/calendar/days?from=${from}&to=${to}`),
    enabled: marks,
    staleTime: 60_000,
  });
  const byDay = useMemo(() => new Map((q.data ?? []).map((d) => [d.date, d])), [q.data]);

  const canBack = open ? !minDate || month > firstOfMonth(minDate) : !minDate || addDays(monday, -1) >= minDate;
  const canForward = open ? !maxDate || shiftMonth(month, 1) <= maxDate : !maxDate || addDays(monday, 7) <= maxDate;
  const back = () => {
    if (!canBack) return;
    setDir(-1);
    if (open) setMonth(shiftMonth(month, -1));
    else onChange(minDate && addDays(monday, -7) < minDate ? minDate : addDays(monday, -7));
  };
  const forward = () => {
    if (!canForward) return;
    setDir(1);
    if (open) setMonth(shiftMonth(month, 1));
    else onChange(addDays(monday, 7));
  };
  // The page follows the finger (with some resistance) and springs back if the swipe was short.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_, g) => dragX.set(g.dx * ((g.dx > 0 ? canBack : canForward) ? 0.45 : 0.15)),
        onPanResponderRelease: (_, g) => {
          const go = g.dx < -50 && canForward ? forward : g.dx > 50 && canBack ? back : null;
          if (go) {
            dragX.set(0);
            go();
          } else dragX.set(withSpring(0, SPRING));
        },
        onPanResponderTerminate: () => dragX.set(withSpring(0, SPRING)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, monday, month, canBack, canForward],
  );

  const toggle = () => {
    setDir(0);
    if (!open) setMonth(firstOfMonth(value));
    setOpen((o) => !o);
  };
  const entering = dir === 0 ? FadeIn.duration(260) : (dir > 0 ? FadeInRight : FadeInLeft).springify().damping(SPRING.damping).stiffness(SPRING.stiffness);

  const cell = (d: string, inMonth: boolean) => {
    const selected = d === value;
    const disabled = (!!minDate && d < minDate) || (!!maxDate && d > maxDate);
    const m = byDay.get(d);
    // Client: her own bookings are the marked days. Staff/admin: days where places are taken.
    const strong = role === 'CLIENT' ? (m?.mine ?? 0) > 0 : (m?.booked ?? 0) > 0;
    const soft = !strong && (m?.classes ?? 0) > 0;
    const count = role === 'CLIENT' ? 0 : (m?.booked ?? 0);
    return (
      <DayCell
        key={d}
        label={`${dayShort(d, lang)} ${dayNum(d)}${strong ? ` · ${role === 'CLIENT' ? t('booked') : t('spotsTaken', { n: count })}` : ''}`}
        selected={selected}
        disabled={disabled}
        onPress={() => onChange(d)}
        style={[strong && !selected && styles.cellBusy, (disabled || !inMonth) && !selected && { opacity: disabled ? 0.28 : 0.4 }]}
      >
        <Text style={[styles.num, selected && { color: colors.white }, strong && !selected && { color: colors.wine }]}>{dayNum(d)}</Text>
        <View style={styles.markRow}>
          {count > 0 ? (
            <Text style={[styles.count, selected && { color: colors.white }]}>{count}</Text>
          ) : strong ? (
            <View style={[styles.dot, { backgroundColor: selected ? colors.white : colors.wine }]} />
          ) : soft ? (
            <View style={[styles.dot, { backgroundColor: selected ? colors.wineSoft : colors.blushDeep }]} />
          ) : d === today ? (
            <Text style={[styles.today, selected && { color: colors.white }]}>✦</Text>
          ) : null}
        </View>
      </DayCell>
    );
  };

  return (
    <Animated.View layout={LinearTransition.springify().damping(SPRING.damping).stiffness(SPRING.stiffness)} style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.month}>{monthTitle(open ? month : value, lang)}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityLabel={t('back')} disabled={!canBack} onPress={back} style={[styles.arrow, !canBack && { opacity: 0.3 }]}>
            <Feather name="chevron-left" size={18} color={colors.ink} />
          </Pressable>
          <Pressable accessibilityLabel={t('next')} disabled={!canForward} onPress={forward} style={[styles.arrow, !canForward && { opacity: 0.3 }]}>
            <Feather name="chevron-right" size={18} color={colors.ink} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={open ? t('showWeek') : t('showMonth')} onPress={toggle} style={styles.fold}>
            <Feather name={open ? 'minimize-2' : 'maximize-2'} size={15} color={colors.wine} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        {(open ? grid[0] : week).map((d) => (
          <Text key={d} style={styles.head}>{dayShort(d, lang)}</Text>
        ))}
      </View>
      <View {...pan.panHandlers} style={styles.page}>
        <Animated.View key={open ? `m${month}` : `w${monday}`} entering={entering} style={dragStyle}>
          {open ? (
            grid.map((w) => (
              <View key={w[0]} style={styles.weekRow}>
                {w.map((d) => cell(d, d.slice(0, 7) === month.slice(0, 7)))}
              </View>
            ))
          ) : (
            <View style={styles.weekRow}>{week.map((d) => cell(d, true))}</View>
          )}
        </Animated.View>
      </View>

      {marks ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.wine }]} />
            <Text style={styles.legendText}>{role === 'CLIENT' ? t('legendMine') : t('legendBooked')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.blushDeep }]} />
            <Text style={styles.legendText}>{role === 'CLIENT' ? t('legendClasses') : t('legendEmpty')}</Text>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

/** A day that gives a little under the finger; the wine bubble of the chosen day springs in. */
function DayCell({ label, selected, disabled, onPress, style, children }: { label: string; selected: boolean; disabled: boolean; onPress: () => void; style: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => scale.set(withSpring(0.88, SPRING))}
      onPressOut={() => scale.set(withSpring(1, SPRING))}
      style={[styles.cell, style, press]}
    >
      {selected ? <Animated.View entering={ZoomIn.springify().damping(14).stiffness(220)} style={styles.bubble} /> : null}
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  page: { overflow: 'hidden' },
  bubble: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.md, backgroundColor: colors.wine, ...shadow },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.md, ...shadow },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm, paddingHorizontal: 4 },
  month: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, letterSpacing: -0.3, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  fold: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush, marginLeft: 4 },
  weekRow: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 10, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  cell: { flex: 1, aspectRatio: 1, maxHeight: 56, margin: 2, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cellBusy: { backgroundColor: colors.blush },
  num: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  markRow: { height: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  count: { fontFamily: fonts.semibold, fontSize: 9.5, color: colors.wine },
  today: { fontSize: 8, color: colors.wine },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft },
});
