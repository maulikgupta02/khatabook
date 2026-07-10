import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/lib/supabase/useSession';
import { colors } from '@/constants/theme';

export default function Index() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgPage }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  // Role-based redirect (owner vs customer) lands here once shop_owner_profiles /
  // customers lookup is wired up in Phase 1.
  return <Redirect href="/(auth)/login" />;
}
