import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatMonth, formatDate } from '@/lib/format';
import { colors, fonts, radii, spacing } from '@/constants/theme';

type BillResponse = {
  shopName: string;
  customerName: string;
  month: string;
  deliveries: {
    delivery_date: string;
    quantity: number;
    unit_price: number;
    status: string;
    is_extra: boolean;
    items: { name: string; unit: string } | null;
  }[];
  payments: { amount: number; payment_date: string; note: string | null }[];
  totalAmount: number;
  totalPaid: number;
  balance: number;
};

export default function PublicBill() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<BillResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('resolve-bill-token', {
          body: { token },
        });
        if (fnError || !data || data.error) throw new Error(data?.error ?? 'This bill link is invalid or has expired.');
        if (!cancelled) setBill(data as BillResponse);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'This bill link is invalid or has expired.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <View style={styles.wrap}>
      {/* Light background reaches the top here (centered card layout), so dark status
          bar icons read correctly against it. */}
      <StatusBar style="dark" />
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoLetter}>{bill?.shopName?.[0]?.toUpperCase() ?? 'G'}</Text>
          </View>
          <Text style={styles.shopName}>{bill?.shopName ?? 'Gupta Dairy'}</Text>
          {bill ? <Text style={styles.subhead}>{formatMonth(bill.month)} bill for {bill.customerName}</Text> : null}
        </View>
        <View style={styles.body}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : error ? (
            <Text style={styles.message}>{error}</Text>
          ) : bill ? (
            <ScrollView contentContainerStyle={{ gap: spacing.md }}>
              <View style={styles.summaryRow}>
                <SummaryStat label="Billed" value={formatCurrency(bill.totalAmount)} />
                <SummaryStat label="Paid" value={formatCurrency(bill.totalPaid)} />
                <SummaryStat label="Balance" value={formatCurrency(bill.balance)} emphasis />
              </View>

              {bill.deliveries.map((d, idx) => (
                <View key={idx} style={styles.deliveryRow}>
                  <Text style={styles.deliveryDate}>{formatDate(d.delivery_date)}</Text>
                  <Text style={styles.deliveryItem}>
                    {d.items?.name ?? 'Item'} · {d.quantity} {d.items?.unit}
                    {d.is_extra ? ' (extra)' : ''}
                    {d.status === 'skipped' ? ' — not delivered' : ''}
                  </Text>
                  <Text style={styles.deliveryAmount}>
                    {d.status === 'skipped' ? '—' : formatCurrency(Number(d.quantity) * Number(d.unit_price))}
                  </Text>
                </View>
              ))}

              {bill.payments.length > 0 ? (
                <View style={{ gap: 4 }}>
                  <Text style={styles.sectionTitle}>Payments</Text>
                  {bill.payments.map((p, idx) => (
                    <Text key={idx} style={styles.deliveryItem}>
                      {formatDate(p.payment_date)} — {formatCurrency(p.amount)}
                      {p.note ? ` (${p.note})` : ''}
                    </Text>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function SummaryStat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, emphasis && { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bgPage, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 412,
    maxHeight: '90%',
    backgroundColor: colors.bgCard,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: { backgroundColor: colors.primary, padding: spacing.xxl, alignItems: 'center' },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoLetter: { color: colors.primary, fontFamily: fonts.headingBold, fontSize: 22 },
  shopName: { color: colors.white, fontFamily: fonts.headingBold, fontSize: 20 },
  subhead: { color: colors.white, fontFamily: fonts.body, fontSize: 12.5, opacity: 0.9, marginTop: 4 },
  body: { padding: spacing.xl, minHeight: 120 },
  message: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderDivider, paddingBottom: spacing.md },
  summaryLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.textMuted3 },
  summaryValue: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deliveryDate: { fontFamily: fonts.bodySemiBold, fontSize: 11.5, color: colors.textSecondary, width: 44 },
  deliveryItem: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary, flex: 1 },
  deliveryAmount: { fontFamily: fonts.headingBold, fontSize: 13, color: colors.primary },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted3, marginTop: spacing.sm },
});
