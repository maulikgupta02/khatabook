import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase/client';
import { useShop } from '@/lib/supabase/useShop';
import { useSession } from '@/lib/supabase/useSession';
import { logout } from '@/lib/supabase/logout';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Chip } from '@/components/Chip';
import { colors, fonts, spacing } from '@/constants/theme';
import { digitsOnly, isValidLocalMobile, toStoredMobile, fromStoredMobile } from '@/lib/format';
import type { Shop, ShopCategory } from '@/lib/supabase/types';

const CATEGORIES: { value: ShopCategory; label: string }[] = [
  { value: 'milk', label: 'Milk' },
  { value: 'kirana', label: 'Kirana' },
  { value: 'tiffin', label: 'Tiffin' },
  { value: 'newspaper', label: 'Newspaper' },
  { value: 'other', label: 'Other' },
];

export default function OwnerSettings() {
  const { shopId, loading: shopLoading } = useShop();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shopId) return;
    const { data } = await supabase.from('shops').select('*').eq('id', shopId).single();
    setShop(data ?? null);
    setLoading(false);
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  if (shopLoading || loading || !shop) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
        <ScreenHeader title="Settings" />
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <ShopDetailsForm shop={shop} onSaved={load} />
        <OwnerPhoneForm />
        <ChangePasswordForm />
        <Button label="Log Out" variant="danger" onPress={logout} />
      </ScrollView>
    </View>
  );
}

function ShopDetailsForm({ shop, onSaved }: { shop: Shop; onSaved: () => void }) {
  const [name, setName] = useState(shop.name);
  const [category, setCategory] = useState<ShopCategory>(shop.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError('Shop name is required.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('shops')
        .update({ name: name.trim(), category })
        .eq('id', shop.id);
      if (updateError) throw updateError;
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save shop details');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={styles.sectionTitle}>Shop Details</Text>
      <TextField label="Shop name" value={name} onChangeText={setName} placeholder="Your shop name" />
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Chip key={c.value} label={c.label} active={category === c.value} onPress={() => setCategory(c.value)} />
          ))}
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={saved ? 'Saved!' : 'Save Shop Details'} onPress={handleSave} loading={saving} />
    </Card>
  );
}

function OwnerPhoneForm() {
  const { session } = useSession();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('shop_owner_profiles')
      .select('phone')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        setPhone(data?.phone ? fromStoredMobile(data.phone) : '');
        setLoading(false);
      });
  }, [session?.user.id]);

  async function handleSave() {
    if (!session) return;
    setError(null);
    setSaved(false);
    if (!isValidLocalMobile(phone)) {
      setError('Mobile number must be exactly 10 digits.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('shop_owner_profiles')
        .update({ phone: toStoredMobile(phone) })
        .eq('user_id', session.user.id);
      if (updateError) throw updateError;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save phone number');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={styles.sectionTitle}>Your Phone Number</Text>
      <TextField
        label="Mobile number (+91)"
        value={phone}
        onChangeText={(v) => setPhone(digitsOnly(v, 10))}
        keyboardType="number-pad"
        maxLength={10}
        placeholder="10-digit number"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={saved ? 'Saved!' : 'Save Phone Number'} onPress={handleSave} loading={saving} />
    </Card>
  );
}

function ChangePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError(null);
    setSaved(false);
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword('');
      setConfirmPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={styles.sectionTitle}>Change Password</Text>
      <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" />
      <TextField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={saved ? 'Saved!' : 'Change Password'} onPress={handleSave} loading={saving} />
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  sectionTitle: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { color: colors.dangerText, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
