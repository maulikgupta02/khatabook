import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase/client';
import { useShop } from '@/lib/supabase/useShop';
import { formatCurrency, todayIso } from '@/lib/format';
import { OFFLINE_SUPPORTED } from '@/lib/offline/db';
import { enqueueMutation, countPendingMutations, type QueuedMutation, listPendingMutations } from '@/lib/offline/queue';
import { syncPendingMutations } from '@/lib/offline/sync';
import { saveTodayCache, loadTodayCache } from '@/lib/offline/todayCache';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Chip } from '@/components/Chip';
import { ConfirmModal } from '@/components/ConfirmModal';
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

type TodaySnapshot = {
  customers: Customer[];
  items: Item[];
  itemPrices: Record<string, number>;
  expected: ExpectedDelivery[];
  extras: DeliveryRecord[];
};

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  delivered: 'Delivered',
  changed: 'Changed',
  skipped: 'Skipped',
  extra: 'Extra',
};

export default function OwnerToday() {
  const { shopId, loading: shopLoading } = useShop();
  const date = todayIso();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemPrices, setItemPrices] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rowsFromServer = useCallback((snapshot: TodaySnapshot): Row[] => {
    const expectedRows: Row[] = snapshot.expected.map((e) => ({
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
    const extraRows: Row[] = snapshot.extras.map((r) => ({
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
    return [...expectedRows, ...extraRows];
  }, []);

  // Reconciles fresh/cached server rows with anything still sitting in the local
  // mutation queue -- without this, a mutation that hasn't synced yet (or a whole
  // offline session's worth of them after an app restart) would visually vanish the
  // next time this screen loads, even though it's still genuinely pending.
  const mergePending = useCallback((baseRows: Row[], pending: QueuedMutation[]): Row[] => {
    let next = baseRows;
    for (const mutation of pending) {
      const payload = JSON.parse(mutation.payload);
      if (mutation.type === 'mark_delivery') {
        if (payload.p_is_extra) {
          const exists = next.some((r) => r.key === payload.p_client_mutation_id);
          if (!exists) {
            next = [
              ...next,
              {
                key: payload.p_client_mutation_id,
                customerId: payload.p_customer_id,
                itemId: payload.p_item_id,
                recordId: payload.p_client_mutation_id,
                expectedQuantity: null,
                actualQuantity: Number(payload.p_quantity),
                unitPrice: Number(payload.p_unit_price),
                status: payload.p_status,
                isExtra: true,
              },
            ];
          }
        } else {
          next = next.map((r) =>
            !r.isExtra && r.customerId === payload.p_customer_id && r.itemId === payload.p_item_id
              ? {
                  ...r,
                  recordId: r.recordId ?? payload.p_client_mutation_id,
                  actualQuantity: Number(payload.p_quantity),
                  status: payload.p_status,
                }
              : r
          );
        }
      } else if (mutation.type === 'bulk_complete') {
        next = next.map((r) =>
          !r.isExtra && r.recordId === null
            ? { ...r, recordId: `pending-bulk-${r.key}`, actualQuantity: r.expectedQuantity, status: 'delivered' as DeliveryStatus }
            : r
        );
      }
    }
    return next;
  }, []);

  const load = useCallback(async () => {
    if (!shopId) return;
    let snapshot: TodaySnapshot | null = null;
    let fromCache = false;

    try {
      const [{ data: customerRows }, { data: itemRows }, { data: priceRows }, { data: expected, error: expectedError }, { data: extras }] =
        await Promise.all([
          supabase.from('customers').select('*').eq('shop_id', shopId).eq('is_active', true).order('name'),
          supabase.from('items').select('*').eq('shop_id', shopId).eq('is_active', true).order('name'),
          supabase.from('item_price_history').select('item_id, price').is('effective_to', null),
          supabase.rpc('expected_deliveries', { p_shop_id: shopId, p_date: date }),
          supabase.from('delivery_records').select('*').eq('shop_id', shopId).eq('delivery_date', date).eq('is_extra', true),
        ]);
      if (expectedError) throw expectedError;
      snapshot = {
        customers: customerRows ?? [],
        items: itemRows ?? [],
        itemPrices: Object.fromEntries((priceRows ?? []).map((p) => [p.item_id, Number(p.price)])),
        expected: expected ?? [],
        extras: extras ?? [],
      };
      if (OFFLINE_SUPPORTED) await saveTodayCache(shopId, date, snapshot);
    } catch {
      if (OFFLINE_SUPPORTED) {
        snapshot = await loadTodayCache<TodaySnapshot>(shopId, date);
        fromCache = !!snapshot;
      }
    }

    if (!snapshot) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    let builtRows = rowsFromServer(snapshot);
    let pendingCount = 0;
    if (OFFLINE_SUPPORTED) {
      const pending = await listPendingMutations();
      pendingCount = pending.length;
      builtRows = mergePending(builtRows, pending);
    }

    setCustomers(snapshot.customers);
    setItems(snapshot.items);
    setItemPrices(snapshot.itemPrices);
    setRows(builtRows);
    setUsingCache(fromCache);
    setQueuedCount(pendingCount);
    setLoading(false);
    setRefreshing(false);
  }, [shopId, date, rowsFromServer, mergePending]);

  useEffect(() => {
    load();
  }, [load]);

  // Sync on mount (covers pending mutations left over from a previous offline
  // session) and whenever connectivity comes back.
  const syncingRef = useRef(false);
  const trySync = useCallback(async () => {
    if (!OFFLINE_SUPPORTED || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await syncPendingMutations();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      load();
    }
  }, [load]);

  useEffect(() => {
    if (!OFFLINE_SUPPORTED) return;
    trySync();
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) trySync();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const filteredRowsByCustomer = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rowsByCustomer;
    return rowsByCustomer.filter(([customerId]) => customerMap[customerId].name.toLowerCase().includes(q));
  }, [rowsByCustomer, customerMap, search]);

  const pendingDeliveryCount = rows.filter((r) => !r.isExtra && r.recordId === null).length;
  const doneCount = rows.filter((r) => r.recordId !== null).length;

  async function queueMarkDelivery(row: Row, patch: { quantity: number; status: DeliveryStatus }) {
    if (!shopId) return;
    const clientMutationId = Crypto.randomUUID();
    const payload = {
      p_client_mutation_id: clientMutationId,
      p_shop_id: shopId,
      p_customer_id: row.customerId,
      p_item_id: row.itemId,
      p_delivery_date: date,
      p_quantity: patch.quantity,
      p_unit_price: row.unitPrice,
      p_status: patch.status,
      p_is_extra: row.isExtra,
    };

    setRows((prev) =>
      prev.map((r) =>
        r.key === row.key ? { ...r, recordId: r.recordId ?? clientMutationId, actualQuantity: patch.quantity, status: patch.status } : r
      )
    );
    setEditingKey(null);

    if (OFFLINE_SUPPORTED) {
      await enqueueMutation('mark_delivery', payload);
      setQueuedCount(await countPendingMutations());
      trySync();
    } else {
      await supabase.rpc('upsert_delivery', payload);
      load();
    }
  }

  async function handleDelivered(row: Row) {
    await queueMarkDelivery(row, { quantity: row.expectedQuantity ?? 0, status: 'delivered' });
  }

  async function handleSkipped(row: Row) {
    await queueMarkDelivery(row, { quantity: 0, status: 'skipped' });
  }

  async function handleAddExtra(customerId: string, itemId: string, quantity: number) {
    if (!shopId) return;
    const unitPrice = itemPrices[itemId] ?? 0;
    const clientMutationId = Crypto.randomUUID();
    const payload = {
      p_client_mutation_id: clientMutationId,
      p_shop_id: shopId,
      p_customer_id: customerId,
      p_item_id: itemId,
      p_delivery_date: date,
      p_quantity: quantity,
      p_unit_price: unitPrice,
      p_status: 'extra' as DeliveryStatus,
      p_is_extra: true,
    };

    setRows((prev) => [
      ...prev,
      {
        key: clientMutationId,
        customerId,
        itemId,
        recordId: clientMutationId,
        expectedQuantity: null,
        actualQuantity: quantity,
        unitPrice,
        status: 'extra',
        isExtra: true,
      },
    ]);
    setShowExtraForm(false);

    if (OFFLINE_SUPPORTED) {
      await enqueueMutation('mark_delivery', payload);
      setQueuedCount(await countPendingMutations());
      trySync();
    } else {
      await supabase.rpc('upsert_delivery', payload);
      load();
    }
  }

  // Extras can't go through queueMarkDelivery/upsert_delivery like regular rows do --
  // that RPC resolves extras' conflicts on client_mutation_id alone with DO NOTHING (by
  // design, so a replayed offline mutation is a safe no-op rather than a duplicate). A
  // fresh mutation id for an edit would never match the existing row, so it would insert
  // a second, duplicate extra instead of correcting the first one. A plain update by the
  // record's real id is what's actually needed here; RLS (dr_owner_all) already permits it.
  async function handleEditExtra(row: Row, quantity: number) {
    if (!row.recordId) return;
    setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, actualQuantity: quantity } : r)));
    setEditingKey(null);
    await supabase.from('delivery_records').update({ quantity }).eq('id', row.recordId);
    load();
  }

  // Same reasoning as handleEditExtra above: a plain delete-by-id, not offline-queued.
  // For a regular row this undoes the mark entirely -- the row falls back to "pending"
  // since expected_deliveries() computes off the *absence* of a delivery_records row,
  // not a separate deleted flag. For an extra it just removes it from the list.
  async function handleDeleteRow(row: Row) {
    if (!row.recordId) return;
    const recordId = row.recordId;
    setDeleting(true);
    if (row.isExtra) {
      setRows((prev) => prev.filter((r) => r.key !== row.key));
    } else {
      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, recordId: null, actualQuantity: null, status: null } : r)));
    }
    await supabase.from('delivery_records').delete().eq('id', recordId);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  async function handleCompleteRemaining() {
    if (!shopId) return;
    if (pendingDeliveryCount === 0) return;
    setBulkSaving(true);

    setRows((prev) =>
      prev.map((r) => (!r.isExtra && r.recordId === null ? { ...r, recordId: `pending-bulk-${r.key}`, actualQuantity: r.expectedQuantity, status: 'delivered' } : r))
    );

    const payload = { p_shop_id: shopId, p_date: date };
    if (OFFLINE_SUPPORTED) {
      await enqueueMutation('bulk_complete', payload);
      setQueuedCount(await countPendingMutations());
      await trySync();
    } else {
      await supabase.rpc('bulk_complete_remaining', payload);
      await load();
    }
    setBulkSaving(false);
  }

  if (shopLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
        <ScreenHeader title="Today's Deliveries" onSettingsPress={() => router.push('/(owner)/settings')} />
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader
        title="Today's Deliveries"
        subtitle={`${doneCount} of ${rows.length} done · ${pendingDeliveryCount} pending${usingCache ? ' · offline (cached)' : ''}`}
        onSettingsPress={() => router.push('/(owner)/settings')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Pressable onPress={() => router.push('/(owner)/today/history')} style={styles.historyLink}>
          <Text style={styles.historyLinkText}>Past Deliveries ›</Text>
        </Pressable>

        {queuedCount > 0 ? (
          <Card style={styles.syncBanner}>
            <Text style={styles.syncText}>
              {queuedCount} change{queuedCount === 1 ? '' : 's'} waiting to sync
            </Text>
            <Button label={syncing ? 'Syncing…' : 'Sync Now'} variant="ghost" onPress={trySync} loading={syncing} style={styles.smallButton} />
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label={`Complete (${pendingDeliveryCount})`}
            onPress={handleCompleteRemaining}
            loading={bulkSaving}
            disabled={pendingDeliveryCount === 0}
            style={{ flex: 1 }}
          />
          <Button label={showExtraForm ? 'Cancel' : '+ Extra'} variant="neutral" onPress={() => setShowExtraForm((v) => !v)} style={{ flex: 1 }} />
        </View>

        {showExtraForm ? (
          <ExtraItemForm customers={customers} items={items} onSave={handleAddExtra} />
        ) : null}

        {rowsByCustomer.length > 0 ? (
          <TextField label="Search" value={search} onChangeText={setSearch} placeholder="Customer name" />
        ) : null}

        {rowsByCustomer.length === 0 ? (
          <ComingSoon note="No deliveries expected today. Set up customers and recurring items to see them here." />
        ) : null}

        {rowsByCustomer.length > 0 && filteredRowsByCustomer.length === 0 ? (
          <Card>
            <Text style={styles.qtyLine}>No customers match "{search}".</Text>
          </Card>
        ) : null}

        {filteredRowsByCustomer.map(([customerId, customerRows]) => (
          <Card key={customerId} style={{ gap: spacing.sm }}>
            <Text style={styles.customerName}>{customerMap[customerId].name}</Text>
            {customerRows.map((row) =>
              editingKey === row.key ? (
                <ChangedForm
                  key={row.key}
                  row={row}
                  itemName={itemMap[row.itemId]?.name ?? 'Item'}
                  onCancel={() => setEditingKey(null)}
                  onSave={(qty) => (row.isExtra ? handleEditExtra(row, qty) : queueMarkDelivery(row, { quantity: qty, status: 'changed' }))}
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
                  {row.isExtra ? (
                    <Button label="Edit" variant="ghost" onPress={() => setEditingKey(row.key)} style={styles.smallButton} />
                  ) : row.recordId === null ? (
                    <View style={styles.actionRow}>
                      <Button label="Delivered" variant="success" onPress={() => handleDelivered(row)} style={styles.smallButton} />
                      <Button label="Changed" variant="primary" onPress={() => setEditingKey(row.key)} style={styles.smallButton} />
                      <Button label="Skip" variant="neutral" onPress={() => handleSkipped(row)} style={styles.smallButton} />
                    </View>
                  ) : (
                    <Button label="Edit" variant="ghost" onPress={() => setEditingKey(row.key)} style={styles.smallButton} />
                  )}
                  {row.recordId !== null ? (
                    <Pressable onPress={() => setDeleteTarget(row)} style={styles.iconButton} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.dangerText} />
                    </Pressable>
                  ) : null}
                </View>
              )
            )}
          </Card>
        ))}
      </ScrollView>

      <ConfirmModal
        visible={deleteTarget !== null}
        title="Delete this entry?"
        message={
          deleteTarget?.isExtra
            ? 'This extra item will be removed entirely. This can\'t be undone.'
            : "This delivery will go back to pending -- today's status for it will be cleared. This can't be undone."
        }
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteRow(deleteTarget)}
      />
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
  customers,
  items,
  onSave,
}: {
  customers: Customer[];
  items: Item[];
  onSave: (customerId: string, itemId: string, quantity: number) => void;
}) {
  const [customerId, setCustomerId] = useState<string | null>(customers[0]?.id ?? null);
  const [itemId, setItemId] = useState<string | null>(items[0]?.id ?? null);
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
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
    onSave(customerId, itemId, n);
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
      <Button label="Add Extra Item" onPress={handleSave} />
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
  historyLink: { alignSelf: 'flex-end' },
  historyLinkText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.primary },
  customerName: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  itemLine: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
  qtyLine: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.xs },
  smallButton: { minHeight: 34, paddingVertical: 6, paddingHorizontal: spacing.sm },
  iconButton: { minHeight: 34, minWidth: 34, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: radii.pill, borderWidth: 1, paddingVertical: 4, paddingHorizontal: spacing.sm },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { color: colors.dangerText, fontFamily: fonts.bodyMedium, fontSize: 13 },
  syncBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.warnBg, borderColor: colors.warnBorder },
  syncText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.warnText, flex: 1 },
});
