import { Pressable, Text, View } from 'react-native';
import { useT, type Lang } from '@/lib/i18n';
import { C } from '@/lib/theme';

/* The pair of words, always visible — as on the website and the web app. */
export function LangSwitch({ light }: { light?: boolean }) {
  const { lang, setLang } = useT();
  const item = (l: Lang, label: string) => (
    <Pressable key={l} onPress={() => setLang(l)} hitSlop={8} accessibilityRole="button" accessibilityState={{ selected: lang === l }}>
      <Text style={{ fontSize: 14, fontWeight: lang === l ? '700' : '400',
        color: light ? C.cream : (lang === l ? C.wine : C.muted), opacity: lang === l ? 1 : 0.75 }}>{label}</Text>
    </Pressable>
  );
  return <View style={{ flexDirection: 'row', gap: 14 }}>{item('sq', 'Shqip')}{item('en', 'English')}</View>;
}
