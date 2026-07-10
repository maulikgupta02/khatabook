import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase/client';
import { useShop } from '@/lib/supabase/useShop';
import { formatCurrency, todayIso } from '@/lib/format';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Chip } from '@/components/Chip';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import type { Customer, Item, DeliveryStatus, ExpectedDelivery, DeliveryRecord } from '@/lib/supabase/types';

type Row = {
  key: string;
  customerId: string;
  itemId: string;
  recordId: string | null;
  expectedQuantity: number | null;
  actualQuantity: number | null;
  unitPrice: number;
  status: DeliveryStatus | null;
  isExtra: boolean;
};

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  delivered: 'Delivered',
  changed: 'Changed',
  skipped: 'Skipped',
  extra: 'Extra',
};

const STATUS_VARIANT: Record<DeliveryStatus, 'success' | 'primary' | 'neutral'> = {
  delivered: 'success',
  changed: 'primary',
  skipped: 'neutral',
  extra: 'primary',
};

export default function OwnerToday() {
  const { shopId, loading: shopLoading } = useShop();
  const date = todayIso();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    const [{ data: customerRows }, { data: itemRows }, { data: expected }, { data: extras }] = await Promise.all([
      supabase.from('customers').select('*').eq('shop_id', shopId).eq('is_active', true).order('name'),
      supabase.from('items').select('*').eq('shop_id', shopId).eq('is_active', true).order('name'),
      supabase.rpc('expected_deliveries', { p_shop_id: shopId, p_date: date }),
      supabase
        .from('delivery_records')
        .select('*')
        .eq('shop_id', shopId)
        .eq('delivery_date', date)
        .eq('is_extra', true),
    ]);

    const expectedRows: Row[] = (expected ?? []).map((e: ExpectedDelivery) => ({
      key: `${e.customer_id}-${e.item_id}`,
      customerId: e.customer_id,
      itemId: e.item_id,
      recordId: e.record_id,
      expectedQuantity: Number(e.expected_quantity),
      actualQuantity: e.actual_quantity !== null ? Number(e.actual_quantity) : null,
      unitPrice: Number(e.unit_price),
      status: e.status,
      isExtra: false,
    }));
    const extraRows: Row[] = (extras ?? []).map((r: DeliveryRecord) => ({
      key: r.id,
      customerId: r.customer_id,
      itemId: r.item_id,
      recordId: r.id,
      expectedQuantity: null,
      actualQuantity: Number(r.quantity),
      unitPrice: Number(r.unit_price),
      status: r.status,
      isExtra: true,
    }));

    setCustomers(customerRows ?? []);
    setItems(itemRows ?? []);
    setRows([...expectedRows, ...extraRows]);
    setLoading(false);
    setRefreshing(false);
  }, [shopId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const customerMap = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c])), [customers]);
  const itemMap = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  const rowsByCustomer = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      if (!groups.has(row.customerId)) groups.set(row.customerId, []);
      groups.get(row.customerId)!.push(row);
    }
    return [...groups.entries()]
      .filter(([customerId]) => customerMap[customerId])
      .sort((a, b) => customerMap[a[0]].name.localeCompare(customerMap[b[0]].name));
  }, [rows, customerMap]);

  const pendingCount = rows.filter((r) => !r.isExtra && r.recordId === null).length;
  const doneCount = rows.filter((r) => r.recordId !== null).length;

  async function upsertRow(row: Row, patch: { quantity: number; status: DeliveryStatus }) {
    if (!shopId) return;
    if (row.recordId) {
      await supabase
        .from('delivery_records')
        .update({ quantity: patch.quantity, status: patch.status, unit_price: row.unitPrice })
        .eq('id', row.recordId);
    } else {
      await supabase.from('delivery_records').insert({
        shop_id: shopId,
        customer_id: row.customerId,
        item_id: row.itemId,
        delivery_date: date,
        quantity: patch.quantity,
        unit_price: row.unitPrice,
        status: patch.status,
        is_extra: false,
      });
    }
    setEditingKey(null);
    load();
  }

  async function handleDelivered(row: Row) {
    await upsertRow(row, { quantity: row.expectedQuantity ?? 0, status: 'delivered' });
  }

  async function handleSkipped(row: Row) {
    await upsertRow(row, { quantity: 0, status: 'skipped' });
  }

  async function handleCompleteRemaining() {
    if (!shopId) return;
    const pending = rows.filter((r) => !r.isExtra && r.recordId === null);
    if (pending.length === 0) return;
    setBulkSaving(true);
    await supabase.from('delivery_records').insert(
      pending.map((row) => ({
        shop_id: shopId,
        customer_id: row.customerId,
        item_id: row.itemId,
        delivery_date: date,
        quantity: row.expectedQuantity ?? 0,
        unit_price: row.unitPrice,
        status: 'delivered' as DeliveryStatus,
        is_extra: false,
      }))
    );
    setBulkSaving(false);
    load();
  }

  if (shopLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
        <ScreenHeader title="Today's Deliveries" />
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Today's Deliveries" subtitle={`${doneCount} of ${rows.length} done · ${pendingCount} pending`} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label={`Complete Remaining (${pendingCount})`}
            onPress={handleCompleteRemaining}
            loading={bulkSaving}
            disabled={pendingCount === 0}
            style={{ flex: 1 }}
          />
          <Button label={showExtraForm ? 'Cancel' : '+ Extra'} variant="neutral" onPress={() => setShowExtraForm((v) => !v)} style={{ flex: 1 }} />
        </View>

        {showExtraForm ? (
          <ExtraItemForm
            shopId={shopId!}
            date={date}
            customers={customers}
            items={items}
            onDone={() => {
              setShowExtraForm(false);
              load();
            }}
          />
        ) : null}

        {rowsByCustomer.length === 0 ? (
          <ComingSoon note="No deliveries expected today. Set up customers and recurring items to see them here." />
        ) : null}

        {rowsByCustomer.map(([customerId, customerRows]) => (
          <Card key={customerId} style={{ gap: spacing.sm }}>
            <Text style={styles.customerName}>{customerMap[customerId].name}</Text>
            {customerRows.map((row) =>
              editingKey === row.key ? (
                <ChangedForm
                  key={row.key}
                  row={row}
                  itemName={itemMap[row.itemId]?.name ?? 'Item'}
                  onCancel={() => setEditingKey(null)}
                  onSave={(qty) => upsertRow(row, { quantity: qty, status: 'changed' })}
                />
              ) : (
                <View key={row.key} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemLine}>
                      {itemMap[row.itemId]?.name ?? 'Item'}
                      {row.isExtra ? ' (extra)' : ''}
                    </Text>
                    <Text style={styles.qtyLine}>
                      {row.actualQuantity ?? row.expectedQuantity} {itemMap[row.itemId]?.unit} ·{' '}
                      {formatCurrency((row.actualQuantity ?? row.expectedQuantity ?? 0) * row.unitPrice)}
                    </Text>
                  </View>
                  {row.status ? (
                    <View style={[styles.badge, badgeStyleFor(row.status)]}>
                      <Text style={styles.badgeText}>{STATUS_LABEL[row.status]}</Text>
                    </View>
                  ) : null}
                  {!row.isExtra ? (
                    row.recordId === null ? (
                      <View style={styles.actionRow}>
                        <Button label="Delivered" variant="success" onPress={() => handleDelivered(row)} style={styles.smallButton} />
                        <Button label="Changed" variant="primary" onPress={() => setEditingKey(row.key)} style={styles.smallButton} />
                        <Button label="Skip" variant="neutral" onPress={() => handleSkipped(row)} style={styles.smallButton} />
                      </View>
                    ) : (
                      <Button label="Edit" variant="ghost" onPress={() => setEditingKey(row.key)} style={styles.smallButton} />
                    )
                  ) : null}
                </View>
              )
            )}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

function ChangedForm({
  row,
  itemName,
  onCancel,
  onSave,
}: {
  row: Row;
  itemName: string;
  onCancel: () => void;
  onSave: (qty: number) => void;
}) {
  const [qty, setQty] = useState(String(row.actualQuantity ?? row.expectedQuantity ?? ''));
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const n = Number(qty);
    if (!qty || Number.isNaN(n) || n < 0) {
      setError('Enter a valid quantity (0 counts as refused).');
      return;
    }
    onSave(n);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.itemLine}>{itemName}</Text>
      <TextField label="Actual quantity delivered" value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label="Cancel" variant="neutral" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Save" onPress={handleSave} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function ExtraItemForm({
  shopId,
  date,
  customers,
  items,
  onDone,
}: {
  shopId: string;
  date: string;
  customers: Customer[];
  items: Item[];
  onDone: () => void;
}) {
  const [customerId, setCustomerId] = useState<string | null>(customers[0]?.id ?? null);
  const [itemId, setItemId] = useState<string | null>(items[0]?.id ?? null);
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const n = Number(qty);
    if (!customerId || !itemId) {
      setError('Add a customer and item first.');
      return;
    }
    if (!qty || Number.isNaN(n) || n <= 0) {
      setError('Enter a valid quantity.');
      return;
    }
    setSaving(true);
    try {
      const { data: price, error: priceError } = await supabase.rpc('price_on_date', {
        p_item_id: itemId,
        p_date: date,
      });
      if (priceError) throw priceError;
      const { error: insertError } = await supabase.from('delivery_records').insert({
        shop_id: shopId,
        customer_id: customerId,
        item_id: itemId,
        delivery_date: date,
        quantity: n,
        unit_price: price ?? 0,
        status: 'extra',
        is_extra: true,
      });
      if (insertError) throw insertError;
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add extra item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Customer</Text>
        <View style={styles.chipRow}>
          {customers.map((c) => (
            <Chip key={c.id} label={c.name} active={customerId === c.id} onPress={() => setCustomerId(c.id)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Item</Text>
        <View style={styles.chipRow}>
          {items.map((i) => (
            <Chip key={i.id} label={i.name} active={itemId === i.id} onPress={() => setItemId(i.id)} />
          ))}
        </View>
      </View>
      <TextField label="Quantity" value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Add Extra Item" onPress={handleSave} loading={saving} />
    </Card>
  );
}

function badgeStyleFor(status: DeliveryStatus) {
  if (status === 'delivered' || status === 'extra') return { backgroundColor: colors.success, borderColor: colors.success };
  if (status === 'changed') return { backgroundColor: colors.primary, borderColor: colors.primary };
  return { backgroundColor: colors.neutralBg, borderColor: colors.neutralBorder };
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  customerName: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  itemLine: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
  qtyLine: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.xs },
  smallButton: { minHeight: 34, paddingVertical: 6, paddingHorizontal: spacing.sm },
  badge: { borderRadius: radii.pill, borderWidth: 1, paddingVertical: 4, paddingHorizontal: spacing.sm },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { color: colors.dangerText, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
