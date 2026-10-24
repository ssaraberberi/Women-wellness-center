import Feather from '@expo/vector-icons/Feather';
import { colors, fonts } from '@/theme';
import type { IconName } from './ui';

/** The same quiet bottom bar for every role: line icons, wine when active. */
export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.wine,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
  tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
  sceneStyle: { backgroundColor: colors.bg },
} as const;

export function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: import('react-native').ColorValue }) {
    return <Feather name={name} size={22} color={typeof color === 'string' ? color : undefined} />;
  };
}
