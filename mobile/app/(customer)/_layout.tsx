import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@/constants/theme';
import { useWebBottomInset } from '@/lib/useWebBottomInset';

function tabIcon(focusedName: keyof typeof Ionicons.glyphMap, unfocusedName: keyof typeof Ionicons.glyphMap) {
  return ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? focusedName : unfocusedName} size={size} color={color as string} />
  );
}

export default function CustomerLayout() {
  const insets = useSafeAreaInsets();
  // Native: insets.bottom is the real, reliable gesture/nav-bar height. Web: the
  // mobile browser's own bottom toolbar occludes part of the viewport by a variable
  // amount that env(safe-area-inset-bottom)/viewport-fit=cover can't measure right
  // (see useWebBottomInset) -- track it live via window.visualViewport instead.
  const webInset = useWebBottomInset();
  const bottomPad = Platform.OS === 'web' ? webInset : insets.bottom;
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
