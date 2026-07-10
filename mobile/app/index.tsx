import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/lib/supabase/useSession';
import { supabase } from '@/lib/supabase/client';
import { colors } from '@/constants/theme';

type Role = 'owner' | 'customer' | 'none';

export default function Index() {
  const { session, loading: sessionLoading } = useSession();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setRole('none');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: ownerProfile } = await supabase
        .from('shop_owner_profiles')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (ownerProfile) {
        setRole('owner');
        return;
      }
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setRole(customer ? 'customer' : 'none');
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id, sessionLoading]);

  if (sessionLoading || role === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgPage }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (role === 'owner') return <Redirect href="/(owner)/today" />;
  if (role === 'customer') return <Redirect href="/(customer)/home" />;
  return <Redirect href="/(auth)/login" />;
}
