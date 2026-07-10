import { View, StyleSheet, ViewProps } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style as object]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderCard,
    padding: spacing.lg,
  },
});
