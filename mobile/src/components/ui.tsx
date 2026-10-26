import Feather from '@expo/vector-icons/Feather';
import { useNetInfo } from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HIT, colors, fonts, radius, space } from '@/theme';
import { errorText, useT } from '@/lib/i18n';
import { openLegal } from '@/lib/legal';

export type IconName = keyof typeof Feather.glyphMap;

// ───────────────────────── type ─────────────────────────

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'bodyMedium' | 'small' | 'caption' | 'label';
const textStyles: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -0.3 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  heading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.inkSoft },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  caption: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.muted },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.inkSoft, letterSpacing: 0.4 },
};

export function Text({ variant = 'body', style, children, numberOfLines, center }: { variant?: TextVariant; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number; center?: boolean }) {
  return (
    <RNText maxFontSizeMultiplier={1.4} numberOfLines={numberOfLines} style={[textStyles[variant], center && { textAlign: 'center' }, style]}>
      {children}
    </RNText>
  );
}

// ───────────────────────── layout ─────────────────────────

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
  edges = ['top'],
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
  footer?: ReactNode;
}) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, { paddingBottom: 40 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.wine} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && styles.padded]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <OfflineBanner />
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Header({ title, right, back, subtitle }: { title: string; right?: ReactNode; back?: boolean; subtitle?: string }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('back')} onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <Feather name="chevron-left" size={24} color={colors.ink} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="title">{title}</Text>
        {subtitle ? <Text variant="small">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({ name, onPress, label, badge }: { name: IconName; onPress: () => void; label: string; badge?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={styles.iconBtn}>
      <Feather name={name} size={21} color={colors.ink} />
      {badge ? (
        <View style={styles.badgeDot}>
          <RNText style={styles.badgeDotText}>{badge > 9 ? '9+' : badge}</RNText>
        </View>
      ) : null}
    </Pressable>
  );
}

export const Row = ({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export const Gap = ({ h = space.lg }: { h?: number }) => <View style={{ height: h }} />;

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ marginTop: space.xl }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
        <Text variant="heading">{title}</Text>
        {action}
      </Row>
      {children}
    </View>
  );
}

// ───────────────────────── controls ─────────────────────────

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  small,
  textColor,
}: {
  title: string;
  textColor?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const v = buttonVariants[variant];
  const tc = textColor ?? (v.text.color as string);
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [styles.button, small && styles.buttonSmall, v.box, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, off && { opacity: 0.55 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={tc} />
      ) : (
        <Row gap={space.sm}>
          {icon ? <Feather name={icon} size={18} color={tc} /> : null}
          <RNText style={[styles.buttonText, small && { fontSize: 14 }, v.text, { color: tc }]}>{title}</RNText>
        </Row>
      )}
    </Pressable>
  );
}

const buttonVariants: Record<string, { box: ViewStyle; text: TextStyle }> = {
  primary: { box: { backgroundColor: colors.wine }, text: { color: colors.white } },
  secondary: { box: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.wine }, text: { color: colors.wine } },
  ghost: { box: { backgroundColor: 'transparent' }, text: { color: colors.wine } },
  danger: { box: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger }, text: { color: colors.danger } },
};

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.wine, borderColor: colors.wine }]}
    >
      <RNText style={[styles.chipText, active && { color: colors.white }]}>{label}</RNText>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 2 }}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} active={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}

export function Field({ label, error, style, ...props }: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      {label ? <Text variant="label" style={{ marginBottom: 6 }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, !!error && { borderColor: colors.danger }, style]}
        accessibilityLabel={label ?? props.placeholder}
        {...props}
      />
      {error ? <Text variant="small" style={{ color: colors.danger, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

export function ToggleRow({ label, value, onChange, hint, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <View style={styles.listRow}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{label}</Text>
        {hint ? <Text variant="small">{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.wine, false: colors.sand }} thumbColor={colors.white} />
    </View>
  );
}

export function ListRow({ icon, label, value, onPress, danger }: { icon?: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.7 }]}>
      {icon ? <Feather name={icon} size={19} color={danger ? colors.danger : colors.inkSoft} /> : null}
      <Text variant="bodyMedium" style={[{ flex: 1 }, danger && { color: colors.danger }]}>
        {label}
      </Text>
      {value ? <Text variant="small">{value}</Text> : null}
      {onPress && !danger ? <Feather name="chevron-right" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

/** "By continuing, you confirm you have read the Privacy Policy" — the policy opens in the browser, no account needed. */
export function PrivacyNotice({ color }: { color?: string }) {
  const { t, lang } = useT();
  return (
    <RNText maxFontSizeMultiplier={1.4} style={[textStyles.small, { textAlign: 'center' }, color ? { color } : null]}>
      {t('privacyNotice')}{' '}
      <RNText accessibilityRole="link" onPress={() => void openLegal('privacy', lang)} style={{ textDecorationLine: 'underline', color: color ?? colors.wine }} suppressHighlighting>
        {t('privacyLink')}
      </RNText>
      .
    </RNText>
  );
}

// ───────────────────────── surfaces ─────────────────────────

export function Card({ children, onPress, style, padded = true }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const content = <View style={[styles.card, padded && { padding: space.lg }, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }}>
      {content}
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'wine' | 'success' | 'warning' | 'danger' }) {
  const t = {
    neutral: [colors.sand, colors.inkSoft],
    wine: [colors.wineSoft, colors.wine],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t[0] }]}>
      <RNText style={[styles.badgeText, { color: t[1] }]}>{label}</RNText>
    </View>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption">{label.toUpperCase()}</Text>
      <Text variant="title" style={{ marginTop: 4 }}>
        {String(value)}
      </Text>
      {sub ? <Text variant="small">{sub}</Text> : null}
    </View>
  );
}

export function KeyValue({ icon, text }: { icon: IconName; text: string }) {
  return (
    <Row gap={space.md} style={{ paddingVertical: 7 }}>
      <Feather name={icon} size={18} color={colors.inkSoft} />
      <Text variant="bodyMedium" style={{ flex: 1, fontFamily: fonts.body }}>
        {text}
      </Text>
    </Row>
  );
}

// ───────────────────────── states ─────────────────────────

export function Skeleton({ height = 72, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ height, borderRadius: radius.md, backgroundColor: colors.sand, opacity: pulse, marginBottom: space.md }, style]} />;
}

export const SkeletonList = ({ count = 4, height = 72 }: { count?: number; height?: number }) => (
  <View accessibilityLabel="Loading">
    {Array.from({ length: count }, (_, i) => (
      <Skeleton key={i} height={height} />
    ))}
  </View>
);

export function EmptyState({ icon = 'feather', title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={24} color={colors.wine} />
      </View>
      <Text variant="heading" center>
        {title}
      </Text>
      {body ? (
        <Text variant="body" center style={{ marginTop: 6 }}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t, lang } = useT();
  return (
    <EmptyState
      icon="cloud-off"
      title={errorText(error, lang)}
      action={onRetry ? <Button title={t('retry')} variant="secondary" onPress={onRetry} /> : undefined}
    />
  );
}

export function OfflineBanner() {
  const net = useNetInfo();
  const { t } = useT();
  if (net.isConnected !== false) return null;
  return (
    <View style={styles.offline} accessibilityLiveRegion="polite">
      <Feather name="wifi-off" size={14} color={colors.white} />
      <RNText style={styles.offlineText}>{t('offline')}</RNText>
    </View>
  );
}

export function Notice({ text, tone = 'wine', icon = 'info' }: { text: string; tone?: 'wine' | 'warning' | 'success' | 'danger'; icon?: IconName }) {
  const c = { wine: [colors.wineSoft, colors.wine], warning: [colors.warningSoft, colors.warning], success: [colors.successSoft, colors.success], danger: [colors.dangerSoft, colors.danger] }[tone];
  return (
    <Row style={[styles.notice, { backgroundColor: c[0] }]} gap={space.sm}>
      <Feather name={icon} size={16} color={c[1]} />
      <Text variant="small" style={{ color: c[1], flex: 1 }}>
        {text}
      </Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingHorizontal: space.xl, paddingTop: space.sm },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, minHeight: 56 },
  iconBtn: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  badgeDot: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeDotText: { color: colors.white, fontSize: 9, fontFamily: fonts.semibold },
  button: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  buttonSmall: { minHeight: HIT, paddingHorizontal: space.lg },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15.5 },
  chip: { minHeight: 36, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center' },
  chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.inkSoft },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: space.lg, fontSize: 16, fontFamily: fonts.body, color: colors.ink },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: 'hidden' },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11.5 },
  stat: { flex: 1, minWidth: '46%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  empty: { alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.wineSoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  offline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.inkSoft, paddingVertical: 6 },
  offlineText: { color: colors.white, fontFamily: fonts.medium, fontSize: 12 },
  notice: { padding: space.md, borderRadius: radius.md, alignItems: 'flex-start' },
});
