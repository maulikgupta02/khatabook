import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Chip } from '@/components/Chip';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import type { ShopCategory } from '@/lib/supabase/types';

const CATEGORIES: { value: ShopCategory; label: string }[] = [
  { value: 'milk', label: 'Milk' },
  { value: 'kirana', label: 'Kirana' },
  { value: 'tiffin', label: 'Tiffin' },
  { value: 'newspaper', label: 'Newspaper' },
  { value: 'other', label: 'Other' },
];

export default function Signup() {
  const [shopName, setShopName] = useState('');
  const [category, setCategory] = useState<ShopCategory>('milk');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup() {
    setError(null);
    if (!shopName.trim() || !fullName.trim() || !email.trim() || password.length < 6) {
      setError('Fill in shop name, your name, email, and a password of at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signUpError) throw signUpError;
      const user = signUpData.user;
      if (!user) throw new Error('Signup did not return a user — try logging in.');

      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .insert({ name: shopName.trim(), category, owner_user_id: user.id })
        .select()
        .single();
      if (shopError) throw shopError;

      const { error: profileError } = await supabase.from('shop_owner_profiles').insert({
        user_id: user.id,
        shop_id: shop.id,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      });
      if (profileError) throw profileError;

      router.replace('/(owner)/today');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgPage }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Set up your shop</Text>
        <Text style={styles.subtitle}>Create your owner account to start tracking deliveries.</Text>

        <View style={styles.card}>
          <TextField label="Shop name" value={shopName} onChangeText={setShopName} placeholder="Gupta Dairy" />

          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <Chip key={c.value} label={c.label} active={category === c.value} onPress={() => setCategory(c.value)} />
              ))}
            </View>
          </View>

          <TextField label="Your full name" value={fullName} onChangeText={setFullName} placeholder="Owner name" />
          <TextField label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98XXXXXXXX" />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Create shop" onPress={handleSignup} loading={loading} style={{ marginTop: spacing.sm }} />
          <Button label="Already have an account? Log in" variant="ghost" onPress={() => router.replace('/(auth)/login')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: spacing.xl, gap: spacing.lg },
  title: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.textPrimary, marginTop: spacing.xl },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderCard,
    padding: spacing.xl,
    gap: spacing.md,
  },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMuted3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { color: colors.dangerText, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
