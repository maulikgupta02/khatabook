import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@/constants/theme';

function tabIcon(focusedName: keyof typeof Ionicons.glyphMap, unfocusedName: keyof typeof Ionicons.glyphMap) {
  return ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? focusedName : unfocusedName} size={size} color={color as string} />
  );
}

export default function CustomerLayout() {
  const insets = useSafeAreaInsets();
  // Native: insets.bottom is the real, reliable gesture/nav-bar height. Web: CSS
  // env(safe-area-inset-bottom) needs viewport-fit=cover to report anything, but turning
  // that on makes some mobile browsers lay the page out edge-to-edge under their own
  // chrome without shrinking the *visible* viewport to match, which pushes fixed-position
  // content (like this tab bar) further down than before instead of fixing it. A small
  // fixed buffer is more reliable there than trying to measure the real inset.
  const bottomPad = Platform.OS === 'web' ? 16 : insets.bottom;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          borderTopColor: colors.borderCard,
          backgroundColor: colors.white,
          height: 56 + bottomPad,
          paddingBottom: bottomPad + 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Today', tabBarIcon: tabIcon('today', 'today-outline') }} />
      <Tabs.Screen name="bills/index" options={{ title: 'My Bill', tabBarIcon: tabIcon('receipt', 'receipt-outline') }} />
      <Tabs.Screen name="bills/[month]" options={{ href: null }} />
    </Tabs>
  );
}
