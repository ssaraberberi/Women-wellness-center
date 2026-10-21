import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LangProvider, useT } from '@/lib/i18n';
import { SessionProvider } from '@/lib/session';
import { C, serif } from '@/lib/theme';

function Nav() {
  const { t } = useT();
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: C.cream },
      headerTintColor: C.wine,
      headerTitleStyle: { fontFamily: serif, color: C.ink },
      headerShadowVisible: false,
      headerBackTitle: t('Back'),
      contentStyle: { backgroundColor: C.cream }
    }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: t('Create account') }} />
      <Stack.Screen name="forgot" options={{ title: t('Forgot your password?') }} />
      <Stack.Screen name="client" options={{ headerShown: false }} />
      <Stack.Screen name="instructor" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="notices" options={{ title: t('Notifications'), presentation: 'modal' }} />
    </Stack>
  );
}

export default function Root() {
  return (
    <SafeAreaProvider>
      <LangProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <Nav />
        </SessionProvider>
      </LangProvider>
    </SafeAreaProvider>
  );
}
