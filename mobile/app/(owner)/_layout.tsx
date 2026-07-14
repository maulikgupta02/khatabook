import { Tabs } from 'expo-router';
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        // insets.bottom accounts for the phone's own gesture/nav bar (native) or the
        // browser chrome's safe-area-inset-bottom (mweb, once +html.tsx sets
        // viewport-fit=cover) -- without it the last row of icons/labels sits underneath
        // that bar instead of above it.
        tabBarStyle: {
          borderTopColor: colors.borderCard,
          backgroundColor: colors.white,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 6,
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
    </Tabs>
  );
}
