import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text } from '@/components/ui';
import { photo, logoLockup } from '@/lib/images';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-store';
import { openLegal } from '@/lib/legal';
import { colors, space } from '@/theme';

/** The studio's own room in daylight, the mark over it, one way in. */
export default function Welcome() {
  const router = useRouter();
  const { t, lang } = useT();
  const setLang = useAuth((s) => s.setLang);
  return (
    <View style={{ flex: 1, backgroundColor: colors.wineDeep }}>
      <Image source={photo('hero')} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} accessibilityIgnoresInvertColors />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(40,18,12,0.28)' }]} />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: space.xl }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Button small variant="ghost" title={lang === 'sq' ? 'English' : 'Shqip'} onPress={() => setLang(lang === 'sq' ? 'en' : 'sq')} textColor={colors.white} style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Image source={logoLockup} style={{ width: 210, height: 110 }} contentFit="contain" tintColor={colors.white} accessibilityLabel="DUA Pilates & SPA" />
          <Text variant="body" style={{ color: 'rgba(255,255,255,0.9)', marginTop: space.md }}>
            {t('tagline')}
          </Text>
        </View>
        <View style={{ gap: space.md }}>
          <Button title={t('begin')} onPress={() => router.push('/sign-in')} textColor={colors.wine} style={{ backgroundColor: colors.white }} />
          <Pressable accessibilityRole="link" onPress={() => void openLegal('privacy', lang)} hitSlop={8}>
            <Text variant="small" center style={{ color: 'rgba(255,255,255,0.85)', textDecorationLine: 'underline' }}>
              {t('privacyPolicy')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
