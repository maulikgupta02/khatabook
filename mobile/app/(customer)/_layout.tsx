import { Tabs } from 'expo-router';
import { colors, fonts } from '@/constants/theme';

export default function CustomerLayout() {
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
      <Tabs.Screen name="home" options={{ title: 'Today' }} />
      <Tabs.Screen name="bills/index" options={{ title: 'My Bill' }} />
    </Tabs>
  );
}
