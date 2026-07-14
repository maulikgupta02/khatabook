import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/Button';
import { colors, fonts, radii, spacing } from '@/constants/theme';

export function PasswordRevealCard({
  name,
  password,
  onDone,
}: {
  name: string;
  password: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Login created for {name}</Text>
      <Text style={styles.hint}>
        Share this password with the customer now — it will not be shown again. They log in with
        their mobile number and this password.
      </Text>
      <View style={styles.passwordBox}>
        <Text style={styles.password}>{password}</Text>
      </View>
      <Button label={copied ? 'Copied!' : 'Copy Password'} variant="neutral" onPress={handleCopy} />
      <Button label="Done" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderCard,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  passwordBox: {
    backgroundColor: colors.warnBg,
    borderWidth: 1,
    borderColor: colors.warnBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  password: { fontFamily: fonts.headingBold, fontSize: 24, letterSpacing: 2, color: colors.warnText },
});
