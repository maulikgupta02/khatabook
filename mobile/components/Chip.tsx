import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing } from '@/constants/theme';

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      <Text style={[styles.label, { color: active ? colors.white : colors.textMuted2 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipInactive: { backgroundColor: colors.neutralBg, borderColor: colors.neutralBorder },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
});
