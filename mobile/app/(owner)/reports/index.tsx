import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { useShop } from '@/lib/supabase/useShop';
import { formatCurrency, formatMonth, formatDate, todayIso, currentMonthIso } from '@/lib/format';
import { toCsv, exportCsv } from '@/lib/csvExport';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Chip } from '@/components/Chip';
import { colors, fonts, spacing } from '@/constants/theme';
import type { Customer } from '@/lib/supabase/types';

type FlagRow = {
  id: string;
  reason_text: string;
  created_at: string;
  customers: { name: string } | null;
  delivery_records: { delivery_date: string; items: { name: string } | null } | null;
};

type ExportRecord = {
  delivery_date: string;
  quantity: number;
  unit_price: number;
  status: string;
  is_extra: boolean;
  customers: { name: string } | null;
  items: { name: string; unit: string } | null;
};

function monthRange(month: string) {
  const monthStart = `${month}-01`;
  const start = new Date(`${monthStart}T00:00:00Z`);
  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  return { monthStart, monthEnd };
}

export default function OwnerReports() {
  const { shopId, loading: shopLoading } = useShop();
  const [todayDone, setTodayDone] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIso());
  const [monthSales, setMonthSales] = useState(0);
  const [monthSalesLoading, setMonthSalesLoading] = useState(false);
  const [defaulters, setDefaulters] = useState<{ customer: Customer; balance: number }[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  const load = useCallback(async () => {
    if (!shopId) return;
    const today = todayIso();

    const [{ data: expected }, { data: balances }, { data: customers }, { data: flagRows }, { data: dateRows }] = await Promise.all([
      supabase.rpc('expected_deliveries', { p_shop_id: shopId, p_date: today }),
      supabase.rpc('shop_customer_balances', { p_shop_id: shopId }),
      supabase.from('customers').select('*').eq('shop_id', shopId).eq('is_active', true),
      supabase
        .from('delivery_flags')
        .select('id, reason_text, created_at, customers(name), delivery_records(delivery_date, items(name))')
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      supabase.from('delivery_records').select('delivery_date').eq('shop_id', shopId).order('delivery_date', { ascending: false }),
    ]);

    setTodayTotal((expected ?? []).length);
    setTodayDone((expected ?? []).filter((e: { record_id: string | null }) => e.record_id !== null).length);

    const monthSet = new Set<string>([currentMonthIso()]);
    for (const r of dateRows ?? []) monthSet.add(r.delivery_date.slice(0, 7));
    setAvailableMonths([...monthSet].sort((a, b) => (a < b ? 1 : -1)));

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

  const loadMonthSales = useCallback(async (month: string) => {
    if (!shopId) return;
    setMonthSalesLoading(true);
    const { monthStart, monthEnd } = monthRange(month);
    const { data } = await supabase
      .from('delivery_records')
      .select('quantity, unit_price')
      .eq('shop_id', shopId)
      .gte('delivery_date', monthStart)
      .lt('delivery_date', monthEnd)
      .neq('status', 'skipped');
    setMonthSales((data ?? []).reduce((sum, r) => sum + Number(r.quantity) * Number(r.unit_price), 0));
    setMonthSalesLoading(false);
  }, [shopId]);

  useEffect(() => {
    loadMonthSales(selectedMonth);
  }, [loadMonthSales, selectedMonth]);

  async function handleResolve(flagId: string, note: string) {
    await supabase
      .from('delivery_flags')
      .update({ status: 'resolved', resolution_note: note.trim() || null, resolved_at: new Date().toISOString() })
      .eq('id', flagId);
    setResolvingId(null);
    load();
  }

  const fetchExportRecords = useCallback(
    async (opts: { gte?: string; lt?: string; lte?: string }) => {
      if (!shopId) return [];
      let query = supabase
        .from('delivery_records')
        .select('delivery_date, quantity, unit_price, status, is_extra, customers(name), items(name, unit)')
        .eq('shop_id', shopId)
        .order('delivery_date', { ascending: true });
      if (opts.gte) query = query.gte('delivery_date', opts.gte);
      if (opts.lt) query = query.lt('delivery_date', opts.lt);
      if (opts.lte) query = query.lte('delivery_date', opts.lte);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ExportRecord[];
    },
    [shopId]
  );

  function recordsToCsv(records: ExportRecord[]) {
    const headers = ['Date', 'Customer', 'Item', 'Quantity', 'Unit', 'Unit Price', 'Amount', 'Status', 'Extra'];
    const rows = records.map((r) => {
      const amount = r.status === 'skipped' ? 0 : Number(r.quantity) * Number(r.unit_price);
      return [
        r.delivery_date,
        r.customers?.name ?? '',
        r.items?.name ?? '',
        r.quantity,
        r.items?.unit ?? '',
        r.unit_price,
        amount.toFixed(2),
        r.status,
        r.is_extra ? 'Yes' : 'No',
      ];
    });
    return toCsv(headers, rows);
  }

  async function handleExportMonth() {
    setExportError(null);
    setExporting('month');
    try {
      const { monthStart, monthEnd } = monthRange(selectedMonth);
      const records = await fetchExportRecords({ gte: monthStart, lt: monthEnd });
      await exportCsv(`deliveries-${selectedMonth}.csv`, recordsToCsv(records));
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Could not export CSV');
    } finally {
      setExporting(null);
    }
  }

  async function handleExportAll() {
    setExportError(null);
    setExporting('all');
    try {
      const records = await fetchExportRecords({});
      await exportCsv('deliveries-all-time.csv', recordsToCsv(records));
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Could not export CSV');
    } finally {
      setExporting(null);
    }
  }

  async function handleExportRange() {
    setExportError(null);
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(rangeFrom) || !dateRe.test(rangeTo)) {
      setExportError('Enter both dates as YYYY-MM-DD.');
      return;
    }
    if (rangeFrom > rangeTo) {
      setExportError('"From" date must be before "To" date.');
      return;
    }
    setExporting('range');
    try {
      const records = await fetchExportRecords({ gte: rangeFrom, lte: rangeTo });
      await exportCsv(`deliveries-${rangeFrom}_to_${rangeTo}.csv`, recordsToCsv(records));
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Could not export CSV');
    } finally {
      setExporting(null);
    }
  }

  if (shopLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
        <ScreenHeader title="Reports" onSettingsPress={() => router.push('/(owner)/settings/index')} />
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Reports" onSettingsPress={() => router.push('/(owner)/settings/index')} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Card style={{ gap: spacing.xs }}>
          <Text style={styles.label}>Today</Text>
          <Text style={styles.stat}>
            {todayDone}/{todayTotal}
          </Text>
          <Text style={styles.sublabel}>deliveries done</Text>
        </Card>

        <Text style={styles.sectionTitle}>Monthly Sales</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {availableMonths.map((m) => (
            <Chip key={m} label={formatMonth(m)} active={selectedMonth === m} onPress={() => setSelectedMonth(m)} />
          ))}
        </ScrollView>
        <Card style={{ gap: spacing.xs }}>
          <Text style={styles.label}>{formatMonth(selectedMonth)}</Text>
          {monthSalesLoading ? (
            <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <Text style={styles.stat}>{formatCurrency(monthSales)}</Text>
          )}
          <Text style={styles.sublabel}>total sales</Text>
        </Card>

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

        <Text style={styles.sectionTitle}>Export Deliveries (CSV)</Text>
        <Card style={{ gap: spacing.md }}>
          {exportError ? <Text style={styles.error}>{exportError}</Text> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label={exporting === 'month' ? 'Exporting…' : `Export ${formatMonth(selectedMonth)}`}
              variant="neutral"
              onPress={handleExportMonth}
              loading={exporting === 'month'}
              disabled={exporting !== null}
              style={{ flex: 1 }}
            />
            <Button
              label={exporting === 'all' ? 'Exporting…' : 'Export All Time'}
              variant="neutral"
              onPress={handleExportAll}
              loading={exporting === 'all'}
              disabled={exporting !== null}
              style={{ flex: 1 }}
            />
          </View>
          <Text style={styles.label}>Or a custom date range</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="From" value={rangeFrom} onChangeText={setRangeFrom} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="To" value={rangeTo} onChangeText={setRangeTo} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <Button
            label={exporting === 'range' ? 'Exporting…' : 'Export Range'}
            onPress={handleExportRange}
            loading={exporting === 'range'}
            disabled={exporting !== null}
          />
        </Card>
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
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  error: { color: colors.dangerText, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
