import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/constants/theme';

export function ComingSoon({ note }: { note: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  text: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
