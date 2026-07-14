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

export default function OwnerLayout() {
  const insets = useSafeAreaInsets();
  // Native: insets.bottom is the real, reliable gesture/nav-bar height. Web: every
  // attempt to *compensate* for the phone/browser's own bottom chrome (viewport-fit=cover,
  // then a window.visualViewport measurement) made the bar worse, not better -- see
  // handover.md's "Bottom tab bar on mobile web" section. That buffer's own assumption
  // (that mweb needs extra padding to clear the OS nav bar) was never actually confirmed;
  // the "white strip" users reported may just have been this buffer's blank space. Testing
  // with zero buffer on web (2026-07-15) to see if the browser already accounts for the
  // real viewport correctly without any compensation at all.
  const bottomPad = Platform.OS === 'web' ? 0 : insets.bottom;
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
      <Tabs.Screen name="today/index" options={{ title: 'Today', tabBarIcon: tabIcon('today', 'today-outline') }} />
      <Tabs.Screen name="customers/index" options={{ title: 'Customers', tabBarIcon: tabIcon('people', 'people-outline') }} />
      <Tabs.Screen name="items/index" options={{ title: 'Items', tabBarIcon: tabIcon('pricetags', 'pricetags-outline') }} />
      <Tabs.Screen name="reports/index" options={{ title: 'Reports', tabBarIcon: tabIcon('bar-chart', 'bar-chart-outline') }} />
      {/* Pushed detail screens under customers/ -- not their own tabs, but Expo Router
          auto-registers every route in this group unless explicitly excluded here. */}
      <Tabs.Screen name="customers/new" options={{ href: null }} />
      <Tabs.Screen name="customers/[id]" options={{ href: null }} />
      {/* Reached via the settings gear icon in ScreenHeader, not a visible tab. */}
      <Tabs.Screen name="settings/index" options={{ href: null }} />
      {/* Reached via the "Past Deliveries" link on Today, not a visible tab. */}
      <Tabs.Screen name="today/history" options={{ href: null }} />
    </Tabs>
  );
}
