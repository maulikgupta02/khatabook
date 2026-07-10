import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/constants/theme';

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: { fontFamily: fonts.headingBold, fontSize: 20, color: colors.white },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.white, opacity: 0.9, marginTop: 2 },
});
