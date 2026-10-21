/* A row of days to swipe through, the way a timetable is read on a phone. */
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useT } from '@/lib/i18n';
import { dayOfMonth, weekdayShort } from '@/lib/format';
import { C, R } from '@/lib/theme';

export function DayStrip({ days, value, onChange, marks }:
  { days: string[]; value: string; onChange: (d: string) => void; marks?: Set<string> }) {
  const { lang } = useT();
  const ref = useRef<any>(null);
  useEffect(() => {
    const i = days.indexOf(value);
    if (i > 2) ref.current?.scrollTo({ x: (i - 2) * 58, animated: false });
  }, []);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
      {days.map(d => {
        const on = d === value;
        return (
          <Pressable key={d} onPress={() => onChange(d)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ width: 52, paddingVertical: 8, borderRadius: R.control, alignItems: 'center',
                     backgroundColor: on ? C.wine : C.white, borderWidth: 1, borderColor: on ? C.wine : C.line }}>
            <Text style={{ fontSize: 12, color: on ? C.cream : C.muted }}>{weekdayShort(d, lang)}</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: on ? C.cream : C.ink }}>{dayOfMonth(d)}</Text>
            <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 3,
                           backgroundColor: marks && marks.has(d) ? (on ? C.cream : C.wine) : 'transparent' }} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
