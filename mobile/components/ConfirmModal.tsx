import { Modal, View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { colors, fonts, radii, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function ConfirmModal({ visible, title, message, confirmLabel = 'Delete', onCancel, onConfirm, loading }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Button label="Cancel" variant="neutral" onPress={onCancel} style={{ flex: 1 }} />
            <Button label={confirmLabel} variant="danger" onPress={onConfirm} loading={loading} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, width: '100%', maxWidth: 360 },
  title: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary },
  message: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textSecondary, marginTop: spacing.xs },
});
