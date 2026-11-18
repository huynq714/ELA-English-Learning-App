import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { AppText, PrimaryButton, Screen } from '@/components/ui';
import { ChangePasswordForm } from '@/features/profile/components/change-password-form';
import { SuccessDialog } from '@/features/profile/components/success-dialog';
import { useChangePassword } from '@/features/profile/view-model/use-change-password';
import { colors } from '@/theme/tokens';

export default function ChangePasswordScreen() {
  const form = useChangePassword();
  const [saved, setSaved] = useState(false);
  const saveDisabled = form.pending || !form.currentPassword || !form.newPassword || !form.confirmPassword;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  const save = async () => {
    Keyboard.dismiss();
    if (await form.submit()) setSaved(true);
  };

  return <Screen testID="screen-change-password" keyboard
    contentStyle={styles.content}
    header={<View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại hồ sơ" disabled={form.pending}
        accessibilityState={{ disabled: form.pending }} onPress={close} style={styles.close}>
        <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={colors.textPrimary} size={20} />
      </Pressable>
      <AppText accessibilityRole="header" size={22} weight="bold" style={styles.title}>Đổi mật khẩu</AppText>
    </View>}
    footer={<View style={styles.footer}>
      <PrimaryButton title={form.pending ? 'Đang lưu…' : 'Lưu lại'} testID="change-password-submit"
        disabled={saveDisabled} onPress={() => void save()} />
    </View>}>
    <ChangePasswordForm form={form} />
    <SuccessDialog visible={saved} title="Đổi mật khẩu thành công" message="Mật khẩu mới đã được lưu."
      testID="change-password-success" onClose={() => { setSaved(false); close(); }} />
  </Screen>;
}

const styles = StyleSheet.create({
  content: { padding: 22 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center' },
  footer: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16 },
});
