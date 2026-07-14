import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { useShop } from '@/lib/supabase/useShop';
import { formatCurrency, formatDate, todayIso } from '@/lib/format';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Chip } from '@/components/Chip';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import type { Customer, DeliveryRecord, DeliveryStatus, Item } from '@/lib/supabase/types';

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  delivered: 'Delivered',
  changed: 'Changed',
  skipped: 'Skipped',
  extra: 'Extra',
};

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function DeliveryHistory() {
  const { shopId, loading: shopLoading } = useShop();
  const [date, setDate] = useState(daysAgoIso(1));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    const [{ data: customerRows }, { data: itemRows }, { data: recordRows }] = await Promise.all([
      supabase.from('customers').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('items').select('*').eq('shop_id', shopId),
      supabase.from('delivery_records').select('*').eq('shop_id', shopId).eq('delivery_date', date).order('created_at'),
    ]);
    setCustomers(customerRows ?? []);
    setItems(itemRows ?? []);
    setRecords(recordRows ?? []);
    setLoading(false);
  }, [shopId, date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const customerMap = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c])), [customers]);
  const itemMap = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  const recordsByCustomer = useMemo(() => {
    const groups = new Map<string, DeliveryRecord[]>();
    for (const r of records) {
      if (!groups.has(r.customer_id)) groups.set(r.customer_id, []);
      groups.get(r.customer_id)!.push(r);
    }
    return [...groups.entries()]
      .filter(([customerId]) => customerMap[customerId])
      .sort((a, b) => customerMap[a[0]].name.localeCompare(customerMap[b[0]].name));
  }, [records, customerMap]);

  async function handleSaveCorrection(record: DeliveryRecord, quantity: number) {
    const status: DeliveryStatus = record.is_extra ? 'extra' : quantity === 0 ? 'skipped' : 'changed';
    setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, quantity, status } : r)));
    setEditingId(null);
    await supabase.from('delivery_records').update({ quantity, status }).eq('id', record.id);
    load();
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const quickDates = [1, 2, 3, 4, 5, 6, 7].map(daysAgoIso);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Past Deliveries" subtitle="Correct an earlier day's record" onSettingsPress={() => router.push('/(owner)/settings')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {quickDates.map((d) => (
            <Chip key={d} label={d === daysAgoIso(1) ? 'Yesterday' : formatDate(d)} active={date === d} onPress={() => setDate(d)} />
          ))}
        </ScrollView>
        <TextField label="Or pick a date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />

        {shopLoading || loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : !dateRe.test(date) ? (
          <Card>
            <Text style={styles.qtyLine}>Enter a valid date as YYYY-MM-DD.</Text>
          </Card>
        ) : date >= todayIso() ? (
          <Card>
            <Text style={styles.qtyLine}>Pick a past date — today's deliveries are edited from the Today tab.</Text>
          </Card>
        ) : recordsByCustomer.length === 0 ? (
          <ComingSoon note="No deliveries recorded for this date." />
        ) : (
          recordsByCustomer.map(([customerId, customerRecords]) => (
            <Card key={customerId} style={{ gap: spacing.sm }}>
              <Text style={styles.customerName}>{customerMap[customerId].name}</Text>
              {customerRecords.map((r) =>
                editingId === r.id ? (
                  <CorrectionForm
                    key={r.id}
                    record={r}
                    itemName={itemMap[r.item_id]?.name ?? 'Item'}
                    onCancel={() => setEditingId(null)}
                    onSave={(qty) => handleSaveCorrection(r, qty)}
                  />
                ) : (
                  <View key={r.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemLine}>
                        {itemMap[r.item_id]?.name ?? 'Item'}
                        {r.is_extra ? ' (extra)' : ''}
                      </Text>
                      <Text style={styles.qtyLine}>
                        {r.quantity} {itemMap[r.item_id]?.unit} · {formatCurrency(Number(r.quantity) * Number(r.unit_price))}
                      </Text>
                    </View>
                    <View style={[styles.badge, badgeStyleFor(r.status)]}>
                      <Text style={styles.badgeText}>{STATUS_LABEL[r.status]}</Text>
                    </View>
                    <Button label="Edit" variant="ghost" onPress={() => setEditingId(r.id)} style={styles.smallButton} />
                  </View>
                )
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function CorrectionForm({
  record,
  itemName,
  onCancel,
  onSave,
}: {
  record: DeliveryRecord;
  itemName: string;
  onCancel: () => void;
  onSave: (qty: number) => void;
}) {
  const [qty, setQty] = useState(String(record.quantity));
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const n = Number(qty);
    if (!qty || Number.isNaN(n) || n < 0) {
      setError('Enter a valid quantity (0 counts as not delivered).');
      return;
    }
    onSave(n);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.itemLine}>{itemName}</Text>
      <TextField label="Corrected quantity" value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label="Cancel" variant="neutral" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Save" onPress={handleSave} style={{ flex: 1 }} />
      </View>
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
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  customerName: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  itemLine: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
  qtyLine: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: radii.pill, borderWidth: 1, paddingVertical: 4, paddingHorizontal: spacing.sm },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
  smallButton: { minHeight: 34, paddingVertical: 6, paddingHorizontal: spacing.sm },
  error: { color: colors.dangerText, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
