import { Tabs } from 'expo-router';
import { colors, fonts } from '@/constants/theme';

export default function OwnerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { borderTopColor: colors.borderCard, backgroundColor: colors.white },
        tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="today/index" options={{ title: 'Today' }} />
      <Tabs.Screen name="customers/index" options={{ title: 'Customers' }} />
      <Tabs.Screen name="items/index" options={{ title: 'Items' }} />
      <Tabs.Screen name="reports/index" options={{ title: 'Reports' }} />
    </Tabs>
  );
}
