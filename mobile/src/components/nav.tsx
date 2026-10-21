/* What every role's tab bar and stack share: the look, and the bell. */
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, serif } from '@/lib/theme';
import { useData } from '@/lib/useData';

export const stackOptions = (back: string) => ({
  headerStyle: { backgroundColor: C.cream },
  headerTintColor: C.wine,
  headerTitleStyle: { fontFamily: serif, color: C.ink },
  headerShadowVisible: false,
  headerBackTitle: back,
  contentStyle: { backgroundColor: C.cream }
});

export const tabOptions = {
  headerStyle: { backgroundColor: C.cream },
  headerTitleStyle: { fontFamily: serif, color: C.ink, fontSize: 20 },
  headerShadowVisible: false,
  tabBarActiveTintColor: C.wine,
  tabBarInactiveTintColor: C.muted,
  tabBarStyle: { backgroundColor: C.cream, borderTopColor: C.line },
  sceneStyle: { backgroundColor: C.cream },
  headerRight: () => <Bell />
};

export const icon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: any; size: number }) => <Ionicons name={name} color={color} size={size} />;

function Bell() {
  const { data } = useData<{ read: boolean }[]>('/api/notices');
  const unread = (data || []).filter(n => !n.read).length;
  return (
    <Pressable onPress={() => router.push('/notices')} hitSlop={10} style={{ marginRight: 16 }} accessibilityLabel="Notifications">
      <Ionicons name="notifications-outline" size={24} color={C.wine} />
      {unread ? (
        <View style={{ position: 'absolute', top: -4, right: -6, backgroundColor: C.wine, borderRadius: 9, minWidth: 18, height: 18,
                       alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: C.cream, fontSize: 11, fontWeight: '700' }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
