import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { useShop } from '@/lib/supabase/useShop';
import { functionErrorMessage } from '@/lib/supabase/invokeError';
import { formatDaysOfWeek, DAY_LABELS, todayIso, currentMonthIso, formatCurrency, formatDate } from '@/lib/format';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Chip } from '@/components/Chip';
import { PasswordRevealCard } from '@/components/PasswordRevealCard';
import { colors, fonts, spacing } from '@/constants/theme';
import type { Customer, Item, RecurringRule, Payment } from '@/lib/supabase/types';

type WhatsAppLogRow = {
  id: string;
  template_name: string;
  status: 'queued' | 'sent' | 'failed';
  error: string | null;
  created_at: string;
};

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shopId } = useShop();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [messages, setMessages] = useState<WhatsAppLogRow[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [billLink, setBillLink] = useState<string | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !shopId) return;
    const [{ data: c }, { data: itemRows }, { data: ruleRows }, { data: paymentRows }, { data: bal }, { data: messageRows }] =
      await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase.from('items').select('*').eq('shop_id', shopId).eq('is_active', true).order('name'),
        supabase.from('customer_recurring_rules').select('*').eq('customer_id', id),
        supabase.from('payments').select('*').eq('customer_id', id).order('payment_date', { ascending: false }),
        supabase.rpc('customer_running_balance', { p_customer_id: id }),
        supabase
          .from('whatsapp_log')
          .select('id, template_name, status, error, created_at')
          .eq('customer_id', id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
    setCustomer(c ?? null);
    setItems(itemRows ?? []);
    setRules(ruleRows ?? []);
    setPayments(paymentRows ?? []);
    setBalance(bal !== null && bal !== undefined ? Number(bal) : null);
    setMessages(messageRows ?? []);
    setLoading(false);
  }, [id, shopId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggleActive() {
    if (!customer) return;
    await supabase.from('customers').update({ is_active: !customer.is_active }).eq('id', customer.id);
    load();
  }

  async function handleRegeneratePassword() {
    if (!customer) return;
    setResetting(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('regenerate-customer-password', {
        body: { customer_id: customer.id },
      });
      if (fnError || !data?.password) {
        throw new Error(await functionErrorMessage(fnError, 'Could not reset password'));
      }
      setResetPassword(data.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset password');
    } finally {
      setResetting(false);
    }
  }

  async function handleToggleRuleActive(rule: RecurringRule) {
    await supabase.from('customer_recurring_rules').update({ is_active: !rule.is_active }).eq('id', rule.id);
    load();
  }

  async function handleGenerateBillLink() {
    if (!customer) return;
    setBillLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-monthly-bill', {
        body: { customer_id: customer.id, month: currentMonthIso() },
      });
      if (fnError || !data?.token) {
        throw new Error(await functionErrorMessage(fnError, 'Could not generate bill link'));
      }
      const base = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'http://localhost:8081';
      setBillLink(`${base}/bill/${data.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate bill link');
    } finally {
      setBillLoading(false);
    }
  }

  if (loading || !customer) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
        <ScreenHeader title="Customer" />
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (resetPassword) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
        <ScreenHeader title={customer.name} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <PasswordRevealCard name={customer.name} password={resetPassword} onDone={() => setResetPassword(null)} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title={customer.name} subtitle={customer.mobile} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.field}>{customer.address}</Text>
          {customer.delivery_notes ? <Text style={styles.notes}>{customer.delivery_notes}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button
              label={customer.is_active ? 'Deactivate' : 'Activate'}
              variant={customer.is_active ? 'neutral' : 'success'}
              onPress={handleToggleActive}
              style={{ flex: 1 }}
            />
            <Button label="Reset Password" variant="ghost" onPress={handleRegeneratePassword} loading={resetting} style={{ flex: 1 }} />
          </View>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>Balance Due</Text>
          <Text style={styles.balance}>{balance !== null ? formatCurrency(balance) : '—'}</Text>
          <Button label="Share This Month's Bill Link" variant="ghost" onPress={handleGenerateBillLink} loading={billLoading} />
          {billLink ? <Text selectable style={styles.billLink}>{billLink}</Text> : null}
        </Card>

        <View style={styles.rulesHeader}>
          <Text style={styles.sectionTitleLg}>Payments</Text>
          <Button label={showPaymentForm ? 'Cancel' : '+ Record'} variant={showPaymentForm ? 'neutral' : 'primary'} onPress={() => setShowPaymentForm((v) => !v)} style={styles.smallButton} />
        </View>

        {showPaymentForm ? (
          <PaymentForm
            shopId={shopId!}
            customerId={customer.id}
            onDone={() => {
              setShowPaymentForm(false);
              load();
            }}
          />
        ) : null}

        {payments.length === 0 && !showPaymentForm ? (
          <Card>
            <Text style={styles.notes}>No payments recorded yet.</Text>
          </Card>
        ) : null}

        {payments.map((p) => (
          <Card key={p.id} style={styles.ruleCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.field}>{formatCurrency(p.amount)}</Text>
              <Text style={styles.notes}>
                {formatDate(p.payment_date)}
                {p.note ? ` · ${p.note}` : ''}
              </Text>
            </View>
          </Card>
        ))}

        <Text style={styles.sectionTitleLg}>WhatsApp Messages</Text>
        {messages.length === 0 ? (
          <Card>
            <Text style={styles.notes}>No messages sent yet.</Text>
          </Card>
        ) : (
          messages.map((m) => (
            <Card key={m.id} style={styles.ruleCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.field}>{m.template_name.replace(/_/g, ' ')}</Text>
                <Text style={styles.notes}>
                  {formatDate(m.created_at.slice(0, 10))}
                  {m.status === 'failed' && m.error ? ` · ${m.error}` : ''}
                </Text>
              </View>
              <View style={[styles.msgBadge, msgBadgeStyleFor(m.status)]}>
                <Text style={styles.msgBadgeText}>{m.status}</Text>
              </View>
            </Card>
          ))
        )}

        <View style={styles.rulesHeader}>
          <Text style={styles.sectionTitleLg}>Recurring Deliveries</Text>
          <Button label={showRuleForm ? 'Cancel' : '+ Add'} variant={showRuleForm ? 'neutral' : 'primary'} onPress={() => setShowRuleForm((v) => !v)} style={styles.smallButton} />
        </View>

        {showRuleForm ? (
          <RuleForm
            customerId={customer.id}
            items={items}
            existingRules={rules}
            onDone={() => {
              setShowRuleForm(false);
              load();
            }}
          />
        ) : null}

        {rules.length === 0 && !showRuleForm ? (
          <Card>
            <Text style={styles.notes}>No recurring items yet. Add one above (e.g. 1 litre milk, every day).</Text>
          </Card>
        ) : null}

        {rules.map((rule) => {
          const item = items.find((i) => i.id === rule.item_id);
          return (
            <Card key={rule.id} style={[styles.ruleCard, !rule.is_active && { opacity: 0.55 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.field}>{item?.name ?? 'Unknown item'}</Text>
                <Text style={styles.notes}>
                  {rule.quantity} {item?.unit} · {formatDaysOfWeek(rule.days_of_week)}
                </Text>
              </View>
              <Button
                label={rule.is_active ? 'Pause' : 'Resume'}
                variant={rule.is_active ? 'neutral' : 'success'}
                onPress={() => handleToggleRuleActive(rule)}
                style={styles.smallButton}
              />
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

function RuleForm({
  customerId,
  items,
  existingRules,
  onDone,
}: {
  customerId: string;
  items: Item[];
  existingRules: RecurringRule[];
  onDone: () => void;
}) {
  const [itemId, setItemId] = useState<string | null>(items[0]?.id ?? null);
  const [days, setDays] = useState<number[]>([]);
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function handleSave() {
    setError(null);
    const qty = Number(quantity);
    if (!itemId) {
      setError('Add an item under Items & Pricing first.');
      return;
    }
    if (days.length === 0) {
      setError('Pick at least one day of the week.');
      return;
    }
    if (!quantity || Number.isNaN(qty) || qty <= 0) {
      setError('Enter a valid quantity.');
      return;
    }
    setSaving(true);
    try {
      const existing = existingRules.find((r) => r.item_id === itemId);
      const sortedDays = [...days].sort((a, b) => a - b);
      if (existing) {
        const { error: updateError } = await supabase
          .from('customer_recurring_rules')
          .update({ days_of_week: sortedDays, quantity: qty, is_active: true })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('customer_recurring_rules').insert({
          customer_id: customerId,
          item_id: itemId,
          days_of_week: sortedDays,
          quantity: qty,
          start_date: todayIso(),
        });
        if (insertError) throw insertError;
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save recurring delivery');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Item</Text>
        <View style={styles.chipRow}>
          {items.map((i) => (
            <Chip key={i.id} label={i.name} active={itemId === i.id} onPress={() => setItemId(i.id)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Days</Text>
        <View style={styles.chipRow}>
          {DAY_LABELS.map((label, d) => (
            <Chip key={d} label={label} active={days.includes(d)} onPress={() => toggleDay(d)} />
          ))}
        </View>
      </View>
      <TextField label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Save" onPress={handleSave} loading={saving} />
    </Card>
  );
}

function PaymentForm({
  shopId,
  customerId,
  onDone,
}: {
  shopId: string;
  customerId: string;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('payments').insert({
        shop_id: shopId,
        customer_id: customerId,
        amount: n,
        payment_date: todayIso(),
        note: note.trim() || null,
      });
      if (insertError) throw insertError;
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <TextField label="Amount received" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="500" />
      <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Cash / UPI" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Record Payment" onPress={handleSave} loading={saving} />
    </Card>
  );
}

function msgBadgeStyleFor(status: WhatsAppLogRow['status']) {
  if (status === 'sent') return { backgroundColor: colors.success, borderColor: colors.success };
  if (status === 'failed') return { backgroundColor: colors.dangerBgSoft, borderColor: colors.dangerBorder };
  return { backgroundColor: colors.neutralBg, borderColor: colors.neutralBorder };
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted3 },
  sectionTitleLg: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary },
  rulesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  field: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
  notes: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  error: { color: colors.dangerText, fontFamily: fonts.bodyMedium, fontSize: 13 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ruleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  smallButton: { minHeight: 34, paddingVertical: 6, paddingHorizontal: spacing.md },
  balance: { fontFamily: fonts.headingBold, fontSize: 24, color: colors.primary },
  billLink: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  msgBadge: { borderRadius: 999, borderWidth: 1, paddingVertical: 4, paddingHorizontal: spacing.sm },
  msgBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.textMuted2, textTransform: 'capitalize' },
});
