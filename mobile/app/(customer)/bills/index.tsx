import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { useCustomer } from '@/lib/supabase/useCustomer';
import { formatCurrency, formatMonth } from '@/lib/format';
import { ScreenHeader } from '@/components/ScreenHeader';
import { logout } from '@/lib/supabase/logout';
import { ComingSoon } from '@/components/ComingSoon';
import { Card } from '@/components/Card';
import { colors, fonts, spacing } from '@/constants/theme';
import type { DeliveryRecord } from '@/lib/supabase/types';

export default function CustomerBills() {
  const { customer, loading: customerLoading } = useCustomer();
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!customer) return;
    const [{ data: recordRows }, { data: bal }] = await Promise.all([
      supabase
        .from('delivery_records')
        .select('*')
        .eq('customer_id', customer.id)
        .neq('status', 'skipped')
        .order('delivery_date', { ascending: false }),
      supabase.rpc('customer_running_balance', { p_customer_id: customer.id }),
    ]);
    setRecords(recordRows ?? []);
    setBalance(bal !== null && bal !== undefined ? Number(bal) : null);
    setLoading(false);
    setRefreshing(false);
  }, [customer]);

  useEffect(() => {
    load();
  }, [load]);

  const months = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of records) {
      const month = r.delivery_date.slice(0, 7);
      totals.set(month, (totals.get(month) ?? 0) + Number(r.quantity) * Number(r.unit_price));
    }
    return [...totals.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [records]);

  if (customerLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
        <ScreenHeader title="My Bill" onLogout={logout} />
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="My Bill" onLogout={logout} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Card style={{ gap: spacing.xs }}>
          <Text style={styles.label}>Balance Due</Text>
          <Text style={styles.balance}>{balance !== null ? formatCurrency(balance) : '—'}</Text>
        </Card>

        {months.length === 0 ? (
          <ComingSoon note="No deliveries recorded yet." />
        ) : (
          months.map(([month, total]) => (
            <Pressable key={month} onPress={() => router.push(`/(customer)/bills/${month}`)}>
              <Card style={styles.row}>
                <Text style={styles.month}>{formatMonth(month)}</Text>
                <Text style={styles.total}>{formatCurrency(total)}</Text>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted3 },
  balance: { fontFamily: fonts.headingBold, fontSize: 28, color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
  total: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.primary },
});
