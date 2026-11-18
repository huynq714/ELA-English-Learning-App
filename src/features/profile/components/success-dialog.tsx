import { Modal, StyleSheet, View } from 'react-native';

import { AppText, PrimaryButton } from '@/components/ui';
import { colors } from '@/theme/tokens';

export function SuccessDialog({ visible, title, message, onClose, testID }: {
  visible: boolean; title: string; message: string; onClose: () => void; testID: string;
}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View accessibilityViewIsModal style={styles.dialog} testID={testID}>
        <AppText size={20} weight="bold" accessibilityRole="alert">{title}</AppText>
        <AppText color={colors.textSecondary}>{message}</AppText>
        <PrimaryButton title="Đã hiểu" onPress={onClose} />
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(24,33,62,0.35)' },
  dialog: { width: '100%', maxWidth: 360, padding: 24, borderRadius: 14, gap: 14, backgroundColor: colors.surface },
});
