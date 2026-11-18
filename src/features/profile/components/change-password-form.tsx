import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, AppTextInput } from '@/components/ui';
import { type useChangePassword } from '@/features/profile/view-model/use-change-password';
import { colors } from '@/theme/tokens';

export function ChangePasswordForm({ form }: { form: ReturnType<typeof useChangePassword> }) {
  const fields = [
    { title: 'Mật khẩu cũ', value: form.currentPassword, set: form.setCurrentPassword, contentType: 'password' },
    { title: 'Mật khẩu mới', value: form.newPassword, set: form.setNewPassword, contentType: 'newPassword' },
    { title: 'Xác nhận mật khẩu', value: form.confirmPassword, set: form.setConfirmPassword, contentType: 'newPassword' },
  ] as const;
  return <View style={styles.form}>
    {fields.map(field => <PasswordField key={field.title} label={field.title} value={field.value}
      onChangeText={field.set} contentType={field.contentType} disabled={form.pending} />)}
    <AppText size={13} color={colors.textSecondary}>Mật khẩu mới cần ít nhất 8 ký tự, có chữ và số.</AppText>
    {form.error && <AppText accessibilityRole="alert" color={colors.error}>{form.error}</AppText>}
  </View>;
}

function PasswordField({ label, value, onChangeText, contentType, disabled }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  contentType: 'password' | 'newPassword';
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const effectiveVisibility = visible && !!value;
  return <View style={styles.field}>
    <AppText size={15} weight="semibold" color={colors.textPrimary}>{label}</AppText>
    <AppTextInput accessibilityLabel={label} secureTextEntry={!effectiveVisibility} autoCapitalize="none"
      autoCorrect={false} textContentType={contentType} maxLength={72} editable={!disabled} icon={null}
      value={value} onChangeText={text => {
        if (!text) setVisible(false);
        onChangeText(text);
      }} style={styles.input}
      trailing={<Pressable accessibilityRole="button"
        accessibilityLabel={`${effectiveVisibility ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`}
        accessibilityState={{ disabled: disabled || !value }} disabled={disabled || !value}
        onPress={() => setVisible(shown => !shown)} style={styles.visibilityButton}>
        <SymbolView name={effectiveVisibility
          ? { ios: 'eye', android: 'visibility', web: 'visibility' }
          : { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }}
          tintColor={value ? colors.primary : colors.textSecondary} size={22} />
      </Pressable>} />
  </View>;
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  field: { gap: 8 },
  input: { paddingVertical: 4, paddingRight: 7 },
  visibilityButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
