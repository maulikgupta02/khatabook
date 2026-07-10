import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { useShop } from '@/lib/supabase/useShop';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import type { Customer } from '@/lib/supabase/types';

export default function OwnerCustomers() {
  const { shopId, loading: shopLoading } = useShop();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true });
    setCustomers(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Customers" subtitle={`${customers.length} customer${customers.length === 1 ? '' : 's'}`} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Button label="+ Add Customer" onPress={() => router.push('/(owner)/customers/new')} />

        {!loading && !shopLoading && customers.length === 0 ? (
          <ComingSoon note="No customers yet. Add your first customer to set up their recurring delivery." />
        ) : null}

        {customers.map((c) => (
          <Pressable key={c.id} onPress={() => router.push(`/(owner)/customers/${c.id}`)}>
            <Card style={[styles.row, !c.is_active && { opacity: 0.55 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.mobile}>{c.mobile}</Text>
              </View>
              {!c.is_active ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Inactive</Text>
                </View>
              ) : null}
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary },
  mobile: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  badge: {
    backgroundColor: colors.neutralBg,
    borderWidth: 1,
    borderColor: colors.neutralBorder,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.textMuted2 },
});
