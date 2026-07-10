import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, fonts, radii, spacing } from '@/constants/theme';

type Role = 'owner' | 'customer';

export default function Login() {
  const [role, setRole] = useState<Role>('owner');
  const [identifier, setIdentifier] = useState(''); // email (owner) or mobile (customer)
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      if (role === 'owner') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: identifier.trim(),
          password,
        });
        if (signInError) throw signInError;
        router.replace('/(owner)/today');
      } else {
        // Customer login resolves mobile -> synthetic auth email server-side.
        // Wired up in Phase 1 once the resolve-customer-login Edge Function exists.
        setError('Customer login will be enabled once the backend is connected (Phase 1).');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
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
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoLetter}>G</Text>
          </View>
          <Text style={styles.title}>Gupta Dairy</Text>
          <Text style={styles.subtitle}>Delivery Manager</Text>
        </View>

        <View style={styles.tabs}>
          <RoleTab label="Shop Owner" active={role === 'owner'} onPress={() => setRole('owner')} />
          <RoleTab label="Customer" active={role === 'customer'} onPress={() => setRole('customer')} />
        </View>

        <View style={styles.card}>
          <TextField
            label={role === 'owner' ? 'Email' : 'Mobile Number'}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType={role === 'owner' ? 'email-address' : 'phone-pad'}
            placeholder={role === 'owner' ? 'you@example.com' : '98XXXXXXXX'}
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Log In" onPress={handleLogin} loading={loading} style={{ marginTop: spacing.sm }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoleTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Button
      label={label}
      variant={active ? 'primary' : 'neutral'}
      onPress={onPress}
      style={{ flex: 1, minHeight: 40, paddingVertical: 10 }}
    />
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  header: { alignItems: 'center', gap: 4 },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoLetter: { color: colors.white, fontFamily: fonts.headingBold, fontSize: 24 },
  title: { fontFamily: fonts.headingBold, fontSize: 20, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderCard,
    padding: spacing.xl,
    gap: spacing.md,
  },
  error: { color: colors.dangerText, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
