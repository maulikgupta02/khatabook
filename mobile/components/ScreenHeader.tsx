import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '@/constants/theme';

export function ScreenHeader({
  title,
  subtitle,
  onLogout,
  onSettingsPress,
}: {
  title: string;
  subtitle?: string;
  /** Customer screens: a direct "Log Out" link (no other account settings exist for them). */
  onLogout?: () => void;
  /** Owner screens: a gear icon that opens Settings, where Log Out lives alongside
   *  Change Password / Shop Details. */
  onSettingsPress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    // The colored bar intentionally extends up behind the (edge-to-edge, transparent)
    // status bar -- insets.top pushes the actual title/logout content below the status
    // bar row instead of under its icons. Pair with <StatusBar style="light" /> so the
    // time/battery/signal icons stay readable against this background.
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {onLogout ? (
          <Pressable onPress={onLogout} hitSlop={8}>
            <Text style={styles.logout}>Log Out</Text>
          </Pressable>
        ) : null}
        {onSettingsPress ? (
          <Pressable onPress={onSettingsPress} hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={colors.white} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontFamily: fonts.headingBold, fontSize: 20, color: colors.white },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.white, opacity: 0.9, marginTop: 2 },
  logout: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.white, opacity: 0.9 },
});
