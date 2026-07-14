import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase/client';
import { functionErrorMessage } from '@/lib/supabase/invokeError';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { PasswordRevealCard } from '@/components/PasswordRevealCard';
import { colors, fonts, spacing } from '@/constants/theme';

export default function NewCustomer() {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; password: string } | null>(null);

  // This tab screen stays mounted across navigation (Expo Router's Tabs doesn't unmount
  // on blur), so without this, reopening "Add Customer" after finishing one would still
  // show the previous customer's PasswordRevealCard instead of a blank form.
  useFocusEffect(
    useCallback(() => {
      setName('');
      setMobile('');
      setAddress('');
      setNotes('');
      setError(null);
      setCreated(null);
    }, [])
  );

  async function handleSave() {
    setError(null);
    if (!name.trim() || !mobile.trim() || !address.trim()) {
      setError('Name, mobile, and address are required.');
      return;
    }
    setSaving(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-customer', {
        body: { name: name.trim(), mobile: mobile.trim(), address: address.trim(), delivery_notes: notes.trim() || null },
      });
      if (fnError || !data?.password) {
        throw new Error(await functionErrorMessage(fnError, 'Could not create customer'));
      }
      setCreated({ name: name.trim(), password: data.password });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgPage }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Add Customer" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {created ? (
          <PasswordRevealCard
            name={created.name}
            password={created.password}
            onDone={() => router.replace('/(owner)/customers')}
          />
        ) : (
          <Card style={{ gap: spacing.md }}>
            <TextField label="Name" value={name} onChangeText={setName} placeholder="Customer name" />
            <TextField label="Mobile number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="98XXXXXXXX" />
            <TextField label="Address" value={address} onChangeText={setAddress} placeholder="Delivery address" multiline />
            <TextField label="Delivery notes (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. leave with watchman" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Create Customer" onPress={handleSave} loading={saving} />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  error: { color: colors.dangerText, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
