import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import { colors, fonts, shadow } from '@/theme';
import type { IconName } from './ui';

/** The same quiet bottom bar for every role: no rule line, a soft lift, a blush halo on the active icon. */
export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.wine,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: { backgroundColor: colors.surface, borderTopWidth: 0, ...shadow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05 },
  tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 10.5, letterSpacing: 0.3 },
  sceneStyle: { backgroundColor: colors.bg },
} as const;

export function tabIcon(name: IconName) {
  return function TabIcon({ color, focused }: { color: import('react-native').ColorValue; focused: boolean }) {
    return (
      <View style={{ width: 44, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.blush : 'transparent' }}>
        <Feather name={name} size={20} color={typeof color === 'string' ? color : undefined} />
      </View>
    );
  };
}
