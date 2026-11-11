import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';
import { AppText, PrimaryButton } from './ui';

const NoticeContext = createContext<(feature: string) => void>(() => {});

export function DemoNoticeProvider({ children }: PropsWithChildren) {
  const [feature, setFeature] = useState<string | null>(null);
  const close = () => setFeature(null);
  return <NoticeContext.Provider value={setFeature}>
    {children}
    <Modal visible={feature !== null} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close} accessibilityLabel="Đóng thông báo">
        <Pressable style={styles.dialog} onPress={() => {}} accessibilityViewIsModal>
          <AppText size={20} weight="bold" accessibilityRole="header">Bản demo giao diện</AppText>
          <AppText color={colors.muted} style={{ lineHeight: 23 }}>
            {feature} chưa được triển khai trong bản layout tĩnh Tuần 2.
          </AppText>
          <View><PrimaryButton title="Đã hiểu" onPress={close} /></View>
        </Pressable>
      </Pressable>
    </Modal>
  </NoticeContext.Provider>;
}

export const useDemoNotice = () => useContext(NoticeContext);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(24,33,62,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 360, padding: 24, borderRadius: 14, backgroundColor: colors.surface, gap: 18 },
});
