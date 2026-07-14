import { Pressable, Text, StyleSheet, ActivityIndicator, PressableProps } from 'react-native';
import { colors, fonts, radii, spacing } from '@/constants/theme';

type Variant = 'primary' | 'neutral' | 'danger' | 'success' | 'ghost';

type Props = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
};

const variantStyles: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.white },
  success: { bg: colors.success, fg: colors.white },
  danger: { bg: colors.dangerBgSoft, fg: colors.dangerText, border: colors.dangerBorder },
  neutral: { bg: colors.neutralBg, fg: colors.textMuted2, border: colors.neutralBorder },
  ghost: { bg: 'transparent', fg: colors.primary },
};

export function Button({ label, variant = 'primary', loading, disabled, style, ...rest }: Props) {
  const v = variantStyles[variant];
  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? 1 : 0,
          opacity: pressed ? 0.85 : disabled ? 0.6 : 1,
        },
        style as object,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.label, { color: v.fg }]} numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  label: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
  },
});
