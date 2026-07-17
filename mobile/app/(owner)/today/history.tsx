import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase/client';
import { useShop } from '@/lib/supabase/useShop';
import { formatCurrency, formatDate, todayIso, DAY_LABELS, MONTH_NAMES } from '@/lib/format';
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
  const [showCalendar, setShowCalendar] = useState(false);

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

  const quickDates = [1, 2, 3, 4, 5, 6, 7].map(daysAgoIso);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Past Deliveries" subtitle="Correct an earlier day's record" onSettingsPress={() => router.push('/(owner)/settings')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {quickDates.map((d) => (
            <Chip key={d} label={d === daysAgoIso(1) ? 'Yesterday' : formatDate(d)} active={!showCalendar && date === d} onPress={() => { setDate(d); setShowCalendar(false); }} />
          ))}
        </ScrollView>

        <Pressable onPress={() => setShowCalendar((v) => !v)} style={styles.calendarToggle}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={styles.calendarToggleText}>{formatDate(date)}, {new Date(`${date}T00:00:00Z`).getUTCFullYear()}</Text>
          <Ionicons name={showCalendar ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
        </Pressable>

        {showCalendar ? <CalendarGrid key={date} selected={date} onSelect={(d) => setDate(d)} /> : null}

        {shopLoading || loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
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

function CalendarGrid({ selected, onSelect }: { selected: string; onSelect: (iso: string) => void }) {
  const selectedDate = new Date(`${selected}T00:00:00Z`);
  const [viewYear, setViewYear] = useState(selectedDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getUTCMonth());

  const today = todayIso();
  const now = new Date();
  const isCurrentMonth = viewYear === now.getUTCFullYear() && viewMonth === now.getUTCMonth();

  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const startWeekday = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
  const cells: (string | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      const month = String(viewMonth + 1).padStart(2, '0');
      return `${viewYear}-${month}-${day}`;
    }),
  ];

  function shiftMonth(delta: number) {
    let month = viewMonth + delta;
    let year = viewYear;
    if (month < 0) { month = 11; year -= 1; }
    if (month > 11) { month = 0; year += 1; }
    setViewMonth(month);
    setViewYear(year);
  }

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.calendarHeader}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.calendarNavButton}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.customerName}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={() => shiftMonth(1)} disabled={isCurrentMonth} hitSlop={8} style={styles.calendarNavButton}>
          <Ionicons name="chevron-forward" size={18} color={isCurrentMonth ? colors.neutralBorder2 : colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.calendarRow}>
        {DAY_LABELS.map((label) => (
          <Text key={label} style={styles.calendarWeekdayLabel}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.calendarRow}>
        {cells.map((iso, idx) => {
          if (!iso) return <View key={idx} style={styles.calendarCell} />;
          const disabled = iso >= today;
          const isSelected = iso === selected;
          return (
            <Pressable
              key={iso}
              disabled={disabled}
              onPress={() => onSelect(iso)}
              style={[styles.calendarCell, isSelected && styles.calendarCellSelected]}
            >
              <Text
                style={[
                  styles.calendarCellText,
                  disabled && styles.calendarCellTextDisabled,
                  isSelected && styles.calendarCellTextSelected,
                ]}
              >
                {Number(iso.slice(-2))}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  customerName: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  itemLine: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
  qtyLine: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: radii.pill, borderWidth: 1, paddingVertical: 4, paddingHorizontal: spacing.sm },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
  smallButton: { minHeight: 34, paddingVertical: 6, paddingHorizontal: spacing.sm },
  error: { color: colors.dangerText, fontFamily: fonts.bodyMedium, fontSize: 13 },
  calendarToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  calendarToggleText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.primary },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarNavButton: { minHeight: 32, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
  calendarRow: { flexDirection: 'row' },
  calendarWeekdayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.textMuted3 },
  calendarCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  calendarCellSelected: { backgroundColor: colors.primary },
  calendarCellText: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
  calendarCellTextDisabled: { color: colors.neutralBorder2 },
  calendarCellTextSelected: { color: colors.white, fontFamily: fonts.bodySemiBold },
});
