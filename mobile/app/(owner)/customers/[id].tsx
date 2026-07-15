import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase/client';
import { useShop } from '@/lib/supabase/useShop';
import { functionErrorMessage } from '@/lib/supabase/invokeError';
import {
  formatDaysOfWeek,
  DAY_LABELS,
  todayIso,
  currentMonthIso,
  formatCurrency,
  formatDate,
  digitsOnly,
  isValidLocalMobile,
  toStoredMobile,
  fromStoredMobile,
} from '@/lib/format';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Chip } from '@/components/Chip';
import { PasswordRevealCard } from '@/components/PasswordRevealCard';
import { colors, fonts, spacing } from '@/constants/theme';
import type { Customer, Item, RecurringRule, Payment, PaymentAudit } from '@/lib/supabase/types';

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
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [expandedAuditPaymentId, setExpandedAuditPaymentId] = useState<string | null>(null);
  const [paymentAudits, setPaymentAudits] = useState<Record<string, PaymentAudit[]>>({});
  const [showEditForm, setShowEditForm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [billLink, setBillLink] = useState<string | null>(null);
  const [billWhatsappSent, setBillWhatsappSent] = useState<boolean | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'reset' | 'delete' | null>(null);
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
          .limit(3),
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

  function handleDeactivatePress() {
    if (!customer) return;
    // Activating is safe and reversible -- only deactivating (which drops them off
    // Today's list) needs a confirm step.
    if (customer.is_active) setConfirmAction('deactivate');
    else handleToggleActive();
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

  async function handleConfirmYes() {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'deactivate') await handleToggleActive();
    else if (action === 'reset') await handleRegeneratePassword();
    else if (action === 'delete') await handleDeleteCustomer();
  }

  async function handleDeleteCustomer() {
    if (!customer) return;
    setDeleting(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('delete-customer', {
        body: { customer_id: customer.id },
      });
      if (fnError || !data?.success) {
        throw new Error(await functionErrorMessage(fnError, 'Could not delete customer'));
      }
      router.replace('/(owner)/customers');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete customer');
      setDeleting(false);
    }
  }

  async function handleToggleRuleActive(rule: RecurringRule) {
    await supabase.from('customer_recurring_rules').update({ is_active: !rule.is_active }).eq('id', rule.id);
    load();
  }

  async function handleToggleAudit(paymentId: string) {
    if (expandedAuditPaymentId === paymentId) {
      setExpandedAuditPaymentId(null);
      return;
    }
    setExpandedAuditPaymentId(paymentId);
    if (!paymentAudits[paymentId]) {
      const { data } = await supabase
        .from('payment_audit')
        .select('*')
        .eq('payment_id', paymentId)
        .order('edited_at', { ascending: false });
      setPaymentAudits((prev) => ({ ...prev, [paymentId]: data ?? [] }));
    }
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
      setBillWhatsappSent(Boolean(data.whatsapp_sent));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate bill link');
    } finally {
      setBillLoading(false);
    }
  }

  async function handleCopyBillLink() {
    if (!billLink) return;
    await Clipboard.setStringAsync(billLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  // wa.me is the standard "click to chat" link WhatsApp itself provides for a user
  // manually sharing something via their own WhatsApp -- distinct from the automated
  // business messages in _shared/whatsapp.ts, which go through the official Meta Cloud
  // API per this project's stack decision. This just opens the owner's own WhatsApp
  // with the message pre-filled; nothing is sent automatically.
  function handleShareBillLinkOnWhatsApp() {
    if (!billLink || !customer) return;
    const message = `Hi ${customer.name}, here's your bill: ${billLink}`;
    Linking.openURL(`https://wa.me/${customer.mobile}?text=${encodeURIComponent(message)}`);
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
          <View style={styles.rulesHeader}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Button label={showEditForm ? 'Cancel' : 'Edit'} variant="ghost" onPress={() => setShowEditForm((v) => !v)} style={styles.smallButton} />
          </View>

          {showEditForm ? (
            <EditCustomerForm
              customer={customer}
              onDone={() => {
                setShowEditForm(false);
                load();
              }}
            />
          ) : (
            <>
              <Text style={styles.field}>{customer.address}</Text>
              {customer.delivery_notes ? <Text style={styles.notes}>{customer.delivery_notes}</Text> : null}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {confirmAction ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Text style={styles.notes}>
                {confirmAction === 'deactivate'
                  ? 'Deactivate this customer? They will drop off Today\'s list until reactivated.'
                  : confirmAction === 'reset'
                  ? "Reset this customer's password? Their current password stops working immediately."
                  : 'Delete this customer? They will disappear from your customer list. Their past deliveries and payments stay on record.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Cancel" variant="neutral" onPress={() => setConfirmAction(null)} style={{ flex: 1 }} />
                <Button label="Yes, Continue" variant="danger" onPress={handleConfirmYes} loading={confirmAction === 'delete' && deleting} style={{ flex: 1 }} />
              </View>
            </View>
          ) : !showEditForm ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label={customer.is_active ? 'Deactivate' : 'Activate'}
                  variant={customer.is_active ? 'neutral' : 'success'}
                  onPress={handleDeactivatePress}
                  style={{ flex: 1 }}
                />
                <Button label="Reset Password" variant="ghost" onPress={() => setConfirmAction('reset')} loading={resetting} style={{ flex: 1 }} />
              </View>
              <Button label="Delete Customer" variant="danger" onPress={() => setConfirmAction('delete')} />
            </View>
          ) : null}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>Balance Due</Text>
          <Text style={styles.balance}>{balance !== null ? formatCurrency(balance) : '—'}</Text>
          <Button label="Share This Month's Bill Link" variant="ghost" onPress={handleGenerateBillLink} loading={billLoading} />
          {billLink ? (
            <View style={{ gap: spacing.sm }}>
              <Text selectable style={styles.billLink}>{billLink}</Text>
              {billWhatsappSent === false ? (
                <Text style={styles.billNote}>No pending balance — WhatsApp bill message wasn't auto-sent. Use the buttons below to share manually if needed.</Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label={linkCopied ? 'Copied!' : 'Copy Link'} variant="neutral" onPress={handleCopyBillLink} style={{ flex: 1 }} />
                <Button label="Share on WhatsApp" variant="success" onPress={handleShareBillLinkOnWhatsApp} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}
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

        {payments.map((p) =>
          editingPaymentId === p.id ? (
            <PaymentEditForm
              key={p.id}
              payment={p}
              onDone={() => {
                setEditingPaymentId(null);
                setPaymentAudits((prev) => {
                  const next = { ...prev };
                  delete next[p.id];
                  return next;
                });
                load();
              }}
              onCancel={() => setEditingPaymentId(null)}
            />
          ) : (
            <Card key={p.id} style={{ gap: spacing.xs }}>
              <View style={styles.ruleCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.field}>{formatCurrency(p.amount)}</Text>
                  <Text style={styles.notes}>
                    {formatDate(p.payment_date)}
                    {p.note ? ` · ${p.note}` : ''}
                  </Text>
                </View>
                <Button label="Edit" variant="ghost" onPress={() => setEditingPaymentId(p.id)} style={styles.smallButton} />
              </View>
              <Button
                label={expandedAuditPaymentId === p.id ? 'Hide History' : 'View History'}
                variant="ghost"
                onPress={() => handleToggleAudit(p.id)}
                style={styles.historyButton}
              />
              {expandedAuditPaymentId === p.id ? (
                <View style={{ gap: 4 }}>
                  {(paymentAudits[p.id] ?? []).length === 0 ? (
                    <Text style={styles.notes}>No edits yet.</Text>
                  ) : (
                    paymentAudits[p.id].map((a) => (
                      <Text key={a.id} style={styles.notes}>
                        {formatDate(a.edited_at.slice(0, 10))}: {formatCurrency(a.old_amount)} → {formatCurrency(a.new_amount)}
                        {a.old_payment_date !== a.new_payment_date ? `, date ${formatDate(a.old_payment_date)} → ${formatDate(a.new_payment_date)}` : ''}
                      </Text>
                    ))
                  )}
                </View>
              ) : null}
            </Card>
          )
        )}

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
          <Button
            label={showRuleForm ? 'Cancel' : '+ Add'}
            variant={showRuleForm ? 'neutral' : 'primary'}
            onPress={() => {
              setEditingRuleId(null);
              setShowRuleForm((v) => !v);
            }}
            style={styles.smallButton}
          />
        </View>

        {showRuleForm ? (
          <RuleForm
            customerId={customer.id}
            items={items}
            existingRules={rules}
            editingRule={rules.find((r) => r.id === editingRuleId) ?? null}
            onDone={() => {
              setShowRuleForm(false);
              setEditingRuleId(null);
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
                label="Edit"
                variant="ghost"
                onPress={() => {
                  setEditingRuleId(rule.id);
                  setShowRuleForm(true);
                }}
                style={styles.smallButton}
              />
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

function EditCustomerForm({ customer, onDone }: { customer: Customer; onDone: () => void }) {
  const [name, setName] = useState(customer.name);
  const [mobile, setMobile] = useState(fromStoredMobile(customer.mobile));
  const [address, setAddress] = useState(customer.address);
  const [notes, setNotes] = useState(customer.delivery_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!name.trim() || !address.trim() || !mobile.trim()) {
      setError('Name, mobile, and address are required.');
      return;
    }
    if (!isValidLocalMobile(mobile)) {
      setError('Mobile number must be exactly 10 digits.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('customers')
        .update({ name: name.trim(), mobile: toStoredMobile(mobile), address: address.trim(), delivery_notes: notes.trim() || null })
        .eq('id', customer.id);
      if (updateError) {
        if (updateError.code === '23505') throw new Error('Another customer in this shop already has that mobile number.');
        throw updateError;
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: spacing.md }}>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Customer name" />
      <TextField
        label="Mobile number (+91)"
        value={mobile}
        onChangeText={(v) => setMobile(digitsOnly(v, 10))}
        keyboardType="number-pad"
        maxLength={10}
        placeholder="10-digit number"
      />
      <TextField label="Address" value={address} onChangeText={setAddress} placeholder="Delivery address" multiline />
      <TextField label="Delivery notes (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. leave with watchman" />
      <Text style={styles.notes}>Changing mobile only updates their saved contact number -- their login stays tied to the account created earlier and isn't affected.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Save Changes" onPress={handleSave} loading={saving} />
    </View>
  );
}

function RuleForm({
  customerId,
  items,
  existingRules,
  editingRule,
  onDone,
}: {
  customerId: string;
  items: Item[];
  existingRules: RecurringRule[];
  editingRule: RecurringRule | null;
  onDone: () => void;
}) {
  const [itemId, setItemId] = useState<string | null>(editingRule?.item_id ?? items[0]?.id ?? null);
  const [days, setDays] = useState<number[]>(editingRule?.days_of_week ?? []);
  const [quantity, setQuantity] = useState(editingRule ? String(editingRule.quantity) : '1');
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
      const sortedDays = [...days].sort((a, b) => a - b);
      if (editingRule) {
        const { error: updateError } = await supabase
          .from('customer_recurring_rules')
          .update({ days_of_week: sortedDays, quantity: qty })
          .eq('id', editingRule.id);
        if (updateError) throw updateError;
      } else {
        const existing = existingRules.find((r) => r.item_id === itemId);
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
            <Chip
              key={i.id}
              label={i.name}
              active={itemId === i.id}
              onPress={() => !editingRule && setItemId(i.id)}
            />
          ))}
        </View>
        {editingRule ? <Text style={styles.notes}>Item can't be changed on an existing recurring delivery -- add a new one instead.</Text> : null}
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

function PaymentEditForm({
  payment,
  onDone,
  onCancel,
}: {
  payment: Payment;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [paymentDate, setPaymentDate] = useState(payment.payment_date);
  const [note, setNote] = useState(payment.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (!paymentDate) {
      setError('Enter a valid date.');
      return;
    }
    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc('update_payment', {
        p_payment_id: payment.id,
        p_amount: n,
        p_payment_date: paymentDate,
        p_note: note.trim() || null,
      });
      if (rpcError) throw rpcError;
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <TextField label="Amount received" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <TextField label="Date (YYYY-MM-DD)" value={paymentDate} onChangeText={setPaymentDate} placeholder="2026-07-15" />
      <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Cash / UPI" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label="Cancel" variant="neutral" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Save" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
      </View>
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
  historyButton: { alignSelf: 'flex-start', minHeight: 24, paddingVertical: 2, paddingHorizontal: 0 },
  balance: { fontFamily: fonts.headingBold, fontSize: 24, color: colors.primary },
  billLink: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  billNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted3 },
  msgBadge: { borderRadius: 999, borderWidth: 1, paddingVertical: 4, paddingHorizontal: spacing.sm },
  msgBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.textMuted2, textTransform: 'capitalize' },
});
