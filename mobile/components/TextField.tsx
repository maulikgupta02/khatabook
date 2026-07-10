import { Text, TextInput, TextInputProps, View, StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
};

export function TextField({ label, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, style as object]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textMuted3,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutralBorder2,
    borderRadius: radii.sm,
    padding: 12,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
});
