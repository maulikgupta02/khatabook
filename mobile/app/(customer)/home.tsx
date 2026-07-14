import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase/client';
import { useCustomer } from '@/lib/supabase/useCustomer';
import { formatCurrency, todayIso } from '@/lib/format';
import { ScreenHeader } from '@/components/ScreenHeader';
import { logout } from '@/lib/supabase/logout';
import { ComingSoon } from '@/components/ComingSoon';
import { Card } from '@/components/Card';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import type { ExpectedDelivery, Item, DeliveryStatus } from '@/lib/supabase/types';

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  delivered: 'Delivered',
  changed: 'Delivered (changed)',
  skipped: 'Not delivered today',
  extra: 'Extra',
};

export default function CustomerHome() {
  const { customer, loading: customerLoading } = useCustomer();
  const [rows, setRows] = useState<ExpectedDelivery[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!customer) return;
    const date = todayIso();
    const [{ data: expected }, { data: itemRows }, { data: bal }] = await Promise.all([
      supabase.rpc('expected_deliveries', { p_shop_id: customer.shop_id, p_date: date }),
      supabase.from('items').select('*').eq('shop_id', customer.shop_id),
      supabase.rpc('customer_running_balance', { p_customer_id: customer.id }),
    ]);
    setRows(expected ?? []);
    setItems(itemRows ?? []);
    setBalance(bal !== null && bal !== undefined ? Number(bal) : null);
    setLoading(false);
    setRefreshing(false);
  }, [customer]);

  useEffect(() => {
    load();
  }, [load]);

  const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));

  if (customerLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
        <ScreenHeader title="Today's Delivery" onLogout={logout} />
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Today's Delivery" subtitle={customer?.name} onLogout={logout} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Card style={{ gap: spacing.xs }}>
          <Text style={styles.label}>Balance Due</Text>
          <Text style={styles.balance}>{balance !== null ? formatCurrency(balance) : '—'}</Text>
        </Card>

        {rows.length === 0 ? (
          <ComingSoon note="No delivery expected today." />
        ) : (
          rows.map((row) => {
            const item = itemMap[row.item_id];
            const qty = row.actual_quantity ?? row.expected_quantity;
            return (
              <Card key={`${row.customer_id}-${row.item_id}`} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item?.name ?? 'Item'}</Text>
                  <Text style={styles.qty}>
                    {qty} {item?.unit}
                  </Text>
                </View>
                <View style={[styles.badge, row.status ? badgeStyleFor(row.status) : styles.badgePending]}>
                  <Text style={[styles.badgeText, !row.status && styles.badgeTextPending]}>
                    {row.status ? STATUS_LABEL[row.status] : 'Pending'}
                  </Text>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function badgeStyleFor(status: DeliveryStatus) {
  if (status === 'delivered' || status === 'extra') return { backgroundColor: colors.success, borderColor: colors.success };
  if (status === 'changed') return { backgroundColor: colors.primary, borderColor: colors.primary };
  return { backgroundColor: colors.neutralBg, borderColor: colors.neutralBorder };
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted3 },
  balance: { fontFamily: fonts.headingBold, fontSize: 28, color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemName: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary },
  qty: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: radii.pill, borderWidth: 1, paddingVertical: 6, paddingHorizontal: spacing.md },
  badgePending: { backgroundColor: colors.warnBg, borderColor: colors.warnBorder },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.white },
  badgeTextPending: { color: colors.warnText },
});
