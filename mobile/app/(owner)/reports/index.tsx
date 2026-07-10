import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { useShop } from '@/lib/supabase/useShop';
import { formatCurrency, formatMonth, formatDate, todayIso, currentMonthIso } from '@/lib/format';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, fonts, spacing } from '@/constants/theme';
import type { Customer } from '@/lib/supabase/types';

type FlagRow = {
  id: string;
  reason_text: string;
  created_at: string;
  customers: { name: string } | null;
  delivery_records: { delivery_date: string; items: { name: string } | null } | null;
};

export default function OwnerReports() {
  const { shopId, loading: shopLoading } = useShop();
  const [todayDone, setTodayDone] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [defaulters, setDefaulters] = useState<{ customer: Customer; balance: number }[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    const today = todayIso();
    const month = currentMonthIso();
    const monthStart = `${month}-01`;
    const start = new Date(`${monthStart}T00:00:00Z`);
    const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

    const [{ data: expected }, { data: monthRecords }, { data: balances }, { data: customers }, { data: flagRows }] = await Promise.all([
      supabase.rpc('expected_deliveries', { p_shop_id: shopId, p_date: today }),
      supabase
        .from('delivery_records')
        .select('quantity, unit_price')
        .eq('shop_id', shopId)
        .gte('delivery_date', monthStart)
        .lt('delivery_date', monthEnd)
        .neq('status', 'skipped'),
      supabase.rpc('shop_customer_balances', { p_shop_id: shopId }),
      supabase.from('customers').select('*').eq('shop_id', shopId).eq('is_active', true),
      supabase
        .from('delivery_flags')
        .select('id, reason_text, created_at, customers(name), delivery_records(delivery_date, items(name))')
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
    ]);

    setTodayTotal((expected ?? []).length);
    setTodayDone((expected ?? []).filter((e: { record_id: string | null }) => e.record_id !== null).length);
    setMonthSales((monthRecords ?? []).reduce((sum, r) => sum + Number(r.quantity) * Number(r.unit_price), 0));

    const customerMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c]));
    const balanceRows = ((balances ?? []) as { customer_id: string; balance: number }[])
      .map((b) => ({ customer: customerMap[b.customer_id] as Customer | undefined, balance: Number(b.balance) }))
      .filter((b): b is { customer: Customer; balance: number } => !!b.customer && b.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    setDefaulters(balanceRows);
    setFlags((flagRows ?? []) as unknown as FlagRow[]);
    setLoading(false);
    setRefreshing(false);
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleResolve(flagId: string, note: string) {
    await supabase
      .from('delivery_flags')
      .update({ status: 'resolved', resolution_note: note.trim() || null, resolved_at: new Date().toISOString() })
      .eq('id', flagId);
    setResolvingId(null);
    load();
  }

  if (shopLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
        <ScreenHeader title="Reports" />
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Reports" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Card style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.label}>Today</Text>
            <Text style={styles.stat}>
              {todayDone}/{todayTotal}
            </Text>
            <Text style={styles.sublabel}>deliveries done</Text>
          </Card>
          <Card style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.label}>{formatMonth(currentMonthIso())}</Text>
            <Text style={styles.stat}>{formatCurrency(monthSales)}</Text>
            <Text style={styles.sublabel}>total sales</Text>
          </Card>
        </View>

        <Text style={styles.sectionTitle}>Pending Payments</Text>
        {defaulters.length === 0 ? (
          <Card>
            <Text style={styles.sublabel}>No outstanding balances.</Text>
          </Card>
        ) : (
          defaulters.map(({ customer, balance }) => (
            <Pressable key={customer.id} onPress={() => router.push(`/(owner)/customers/${customer.id}`)}>
              <Card style={styles.row}>
                <Text style={styles.field}>{customer.name}</Text>
                <Text style={styles.balance}>{formatCurrency(balance)}</Text>
              </Card>
            </Pressable>
          ))
        )}

        <Text style={styles.sectionTitle}>Open Disputes</Text>
        {flags.length === 0 ? (
          <Card>
            <Text style={styles.sublabel}>No open disputes.</Text>
          </Card>
        ) : (
          flags.map((flag) =>
            resolvingId === flag.id ? (
              <ResolveForm key={flag.id} onCancel={() => setResolvingId(null)} onSubmit={(note) => handleResolve(flag.id, note)} />
            ) : (
              <Card key={flag.id} style={{ gap: spacing.xs }}>
                <Text style={styles.field}>{flag.customers?.name ?? 'Customer'}</Text>
                <Text style={styles.sublabel}>
                  {flag.delivery_records?.items?.name ?? 'Item'} · {flag.delivery_records ? formatDate(flag.delivery_records.delivery_date) : ''}
                </Text>
                <Text style={styles.reason}>"{flag.reason_text}"</Text>
                <Button label="Resolve" variant="ghost" onPress={() => setResolvingId(flag.id)} style={styles.smallButton} />
              </Card>
            )
          )
        )}
      </ScrollView>
    </View>
  );
}

function ResolveForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <Card style={{ gap: spacing.sm }}>
      <TextField label="Resolution note (optional)" value={note} onChangeText={setNote} placeholder="e.g. corrected on next visit" />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label="Cancel" variant="neutral" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Mark Resolved" onPress={() => onSubmit(note)} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.textMuted3 },
  stat: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.primary },
  sublabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  sectionTitle: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  field: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
  balance: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.primary },
  reason: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
  smallButton: { minHeight: 34, paddingVertical: 6, paddingHorizontal: spacing.md, alignSelf: 'flex-start' },
});
