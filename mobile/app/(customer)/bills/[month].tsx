import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { useCustomer } from '@/lib/supabase/useCustomer';
import { formatCurrency, formatMonth, formatDate } from '@/lib/format';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, fonts, spacing } from '@/constants/theme';
import type { DeliveryRecord, Item, Payment } from '@/lib/supabase/types';

export default function CustomerBillMonth() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const { customer, loading: customerLoading } = useCustomer();
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!customer || !month) return;
    const monthStart = `${month}-01`;
    const start = new Date(`${monthStart}T00:00:00Z`);
    const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

    const [{ data: recordRows }, { data: itemRows }, { data: paymentRows }] = await Promise.all([
      supabase
        .from('delivery_records')
        .select('*')
        .eq('customer_id', customer.id)
        .gte('delivery_date', monthStart)
        .lt('delivery_date', monthEnd)
        .order('delivery_date', { ascending: true }),
      supabase.from('items').select('*').eq('shop_id', customer.shop_id),
      supabase
        .from('payments')
        .select('*')
        .eq('customer_id', customer.id)
        .gte('payment_date', monthStart)
        .lt('payment_date', monthEnd),
    ]);
    setRecords(recordRows ?? []);
    setItems(itemRows ?? []);
    setPayments(paymentRows ?? []);
    setLoading(false);
  }, [customer, month]);

  useEffect(() => {
    load();
  }, [load]);

  const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));
  const totalDelivered = records
    .filter((r) => r.status !== 'skipped')
    .reduce((sum, r) => sum + Number(r.quantity) * Number(r.unit_price), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  async function handleFlag(recordId: string, reason: string) {
    if (!customer || !reason.trim()) return;
    await supabase.from('delivery_flags').insert({
      delivery_record_id: recordId,
      customer_id: customer.id,
      raised_by: customer.auth_user_id,
      reason_text: reason.trim(),
    });
    setFlaggingId(null);
  }

  if (customerLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
        <ScreenHeader title="Bill" />
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title={formatMonth(month ?? '')} subtitle={`${formatCurrency(totalDelivered)} billed · ${formatCurrency(totalPaid)} paid`} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {records.length === 0 ? (
          <ComingSoon note="No deliveries recorded for this month." />
        ) : (
          records.map((r) =>
            flaggingId === r.id ? (
              <FlagForm key={r.id} onCancel={() => setFlaggingId(null)} onSubmit={(reason) => handleFlag(r.id, reason)} />
            ) : (
              <Card key={r.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.date}>{formatDate(r.delivery_date)}</Text>
                  <Text style={styles.itemLine}>
                    {itemMap[r.item_id]?.name ?? 'Item'} · {r.quantity} {itemMap[r.item_id]?.unit}
                    {r.is_extra ? ' (extra)' : ''}
                    {r.status === 'skipped' ? ' — not delivered' : ''}
                  </Text>
                </View>
                <Text style={styles.amount}>
                  {r.status === 'skipped' ? '—' : formatCurrency(Number(r.quantity) * Number(r.unit_price))}
                </Text>
                <Button label="Flag" variant="ghost" onPress={() => setFlaggingId(r.id)} style={styles.flagButton} />
              </Card>
            )
          )
        )}

        {payments.length > 0 ? (
          <Card style={{ gap: spacing.xs }}>
            <Text style={styles.sectionTitle}>Payments this month</Text>
            {payments.map((p) => (
              <Text key={p.id} style={styles.itemLine}>
                {formatDate(p.payment_date)} — {formatCurrency(p.amount)}
                {p.note ? ` (${p.note})` : ''}
              </Text>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

function FlagForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Card style={{ gap: spacing.sm }}>
      <TextField label="What's wrong with this delivery?" value={reason} onChangeText={setReason} placeholder="e.g. quantity is wrong" />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label="Cancel" variant="neutral" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Submit Flag" onPress={() => onSubmit(reason)} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  date: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.textSecondary },
  itemLine: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textPrimary },
  amount: { fontFamily: fonts.headingBold, fontSize: 14, color: colors.primary },
  flagButton: { minHeight: 30, paddingVertical: 4, paddingHorizontal: spacing.sm },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted3 },
});
