/* The handful of pieces every screen is made of. Every label goes
   through t() on the way in, so a screen writes English and the reader's
   language comes out — the same contract as the web app's el(). */
import { type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput,
  View, type TextInputProps, type ViewStyle, type StyleProp
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { C, R, S, serif } from '@/lib/theme';
import { useT } from '@/lib/i18n';

export function Screen({ children, refreshing, onRefresh, scroll = true, padded = true }:
  { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; scroll?: boolean; padded?: boolean }) {
  const body = scroll
    ? <ScrollView contentContainerStyle={[padded && st.pad, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.wine} /> : undefined}>
        {children}
      </ScrollView>
    : <View style={[{ flex: 1 }, padded && st.pad]}>{children}</View>;
  return <SafeAreaView edges={['left', 'right']} style={st.screen}>{body}</SafeAreaView>;
}

export function Title({ children, sub }: { children: string; sub?: string | null }) {
  const { t } = useT();
  return (
    <View style={{ marginBottom: S.l }}>
      <Text style={st.title}>{t(children)}</Text>
      {sub ? <Text style={st.muted}>{sub}</Text> : null}
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  const { t } = useT();
  return <Text style={st.eyebrow}>{t(children).toUpperCase()}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: any }) {
  return <Text style={[muted ? st.muted : st.body, style]}>{children}</Text>;
}

export function Card({ children, style, onPress, tone }:
  { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: 'wine' | 'sand' }) {
  const look = [st.card, tone === 'wine' && { backgroundColor: C.wine, borderColor: C.wine }, tone === 'sand' && { backgroundColor: C.sand }, style];
  if (!onPress) return <View style={look}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [look, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
}

export function Button({ label, onPress, kind = 'primary', busy, disabled, small, args }:
  { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; busy?: boolean; disabled?: boolean; small?: boolean; args?: (string | number)[] }) {
  const { t } = useT();
  const off = disabled || busy;
  const bg = kind === 'primary' ? C.wine : kind === 'danger' ? C.bad : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? C.cream : kind === 'ghost' ? C.wine : C.wine;
  return (
    <Pressable accessibilityRole="button" disabled={off}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      style={({ pressed }) => [st.btn, small && st.btnSmall, { backgroundColor: bg },
        kind === 'secondary' && { borderWidth: 1, borderColor: C.wine }, (pressed || off) && { opacity: off ? 0.5 : 0.8 }]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[st.btnText, small && { fontSize: 14 }, { color: fg }]}>{t(label, ...(args || []))}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { t } = useT();
  return (
    <View style={{ marginBottom: S.m }}>
      <Text style={st.label}>{t(label)}</Text>
      <TextInput placeholderTextColor={C.muted} {...props} style={[st.input, props.style]} />
    </View>
  );
}

export function Pill({ label, tone = 'neutral', args }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'wine'; args?: (string | number)[] }) {
  const { t } = useT();
  const map = {
    neutral: [C.sand, C.ink], good: [C.goodBg, C.good], warn: [C.warnBg, C.warn], bad: [C.badBg, C.bad], wine: [C.wine, C.cream]
  } as const;
  const [bg, fg] = map[tone];
  return <View style={[st.pill, { backgroundColor: bg }]}><Text style={[st.pillText, { color: fg }]}>{t(label, ...(args || []))}</Text></View>;
}

export function Segmented<T extends string>({ value, options, onChange }:
  { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { t } = useT();
  return (
    <View style={st.seg}>
      {options.map(o => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[st.segItem, value === o.value && st.segOn]}>
          <Text style={[st.segText, value === o.value && { color: C.cream }]}>{t(o.label)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Loading() {
  return <View style={st.center}><ActivityIndicator color={C.wine} size="large" /></View>;
}

export function Empty({ text, args }: { text: string; args?: (string | number)[] }) {
  const { t } = useT();
  return <Text style={[st.muted, { textAlign: 'center', marginVertical: S.xl }]}>{t(text, ...(args || []))}</Text>;
}

export function ErrorNote({ text }: { text: string | null }) {
  const { t } = useT();
  if (!text) return null;
  return <View style={st.error}><Text style={{ color: C.bad }}>{t(text)}</Text></View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: S.s }, style]}>{children}</View>;
}

export function Divider() { return <View style={{ height: 1, backgroundColor: C.line, marginVertical: S.m }} />; }

/* A yes/no before anything that cannot be taken back. */
export function confirm(title: string, message: string, yes: string, no: string, onYes: () => void, danger = true) {
  /* The browser preview has no native alert with buttons. */
  if (Platform.OS === 'web') { if (window.confirm(title + '\n\n' + message)) onYes(); return; }
  Alert.alert(title, message, [{ text: no, style: 'cancel' }, { text: yes, style: danger ? 'destructive' : 'default', onPress: onYes }]);
}

/* More than two answers: each option runs its own action; the last line is "back". */
export function choose(title: string, message: string, options: { text: string; onPress: () => void; danger?: boolean }[], back: string) {
  if (Platform.OS === 'web') { if (window.confirm(title + '\n\n' + message + '\n\n→ ' + options[0].text)) options[0].onPress(); return; }
  Alert.alert(title, message, [...options.map(o => ({ text: o.text, onPress: o.onPress, style: o.danger ? 'destructive' as const : 'default' as const })),
                               { text: back, style: 'cancel' as const }]);
}

export const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  pad: { padding: S.l },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cream, padding: S.xl },
  title: { fontFamily: serif, fontSize: 30, color: C.ink, lineHeight: 36 },
  h2: { fontFamily: serif, fontSize: 21, color: C.ink, marginBottom: S.s },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, color: C.wine, fontWeight: '600', marginBottom: S.s, marginTop: S.l },
  body: { fontSize: 16, color: C.ink, lineHeight: 22 },
  muted: { fontSize: 14, color: C.muted, lineHeight: 20 },
  label: { fontSize: 13, color: C.muted, marginBottom: 6, fontWeight: '500' },
  card: { backgroundColor: C.white, borderRadius: R.card, padding: S.l, marginBottom: S.m, borderWidth: 1, borderColor: C.line },
  btn: { minHeight: 48, borderRadius: R.control, paddingHorizontal: S.l, alignItems: 'center', justifyContent: 'center', marginVertical: S.xs },
  btnSmall: { minHeight: 38, paddingHorizontal: S.m },
  btnText: { fontSize: 16, fontWeight: '600' },
  input: { minHeight: 48, borderRadius: R.control, borderWidth: 1, borderColor: C.line, backgroundColor: C.white,
           paddingHorizontal: S.m, fontSize: 16, color: C.ink },
  pill: { borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '600' },
  seg: { flexDirection: 'row', backgroundColor: C.sand, borderRadius: R.control, padding: 3, marginBottom: S.m },
  segItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: R.control - 2 },
  segOn: { backgroundColor: C.wine },
  segText: { fontSize: 14, color: C.ink, fontWeight: '500' },
  error: { backgroundColor: C.badBg, borderRadius: R.control, padding: S.m, marginBottom: S.m }
});
