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

export default function CustomerLayout() {
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
      <Tabs.Screen name="home" options={{ title: 'Today', tabBarIcon: tabIcon('today', 'today-outline') }} />
      <Tabs.Screen name="bills/index" options={{ title: 'My Bill', tabBarIcon: tabIcon('receipt', 'receipt-outline') }} />
      <Tabs.Screen name="bills/[month]" options={{ href: null }} />
    </Tabs>
  );
}
