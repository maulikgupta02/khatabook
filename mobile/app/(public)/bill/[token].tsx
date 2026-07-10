import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { colors, fonts, radii, spacing } from '@/constants/theme';

export default function PublicBill() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Wired to the resolve-bill-token Edge Function in Phase 3.
        const { error: fnError } = await supabase.functions.invoke('resolve-bill-token', {
          body: { token },
        });
        if (fnError) throw fnError;
      } catch (e) {
        if (!cancelled) setError('This bill isn\'t available yet — the backend lands in Phase 3.');
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
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoLetter}>G</Text>
          </View>
          <Text style={styles.shopName}>Gupta Dairy</Text>
        </View>
        <View style={styles.body}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.message}>{error}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bgPage, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 412,
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
  body: { padding: spacing.xl, minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  message: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center' },
});
