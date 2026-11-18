import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useDemoNotice } from '@/components/demo-notice';
import { AppText, AppTextInput, Asset, PrimaryButton, Screen } from '@/components/ui';
import { useSession } from '@/features/auth/view-model/session-context';
import { useAuthForm } from '@/features/auth/view-model/use-auth-form';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.login;

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const notice = useDemoNotice();
  const { state } = useSession();
  const form = useAuthForm(mode);
  const [hidePassword, setHidePassword] = useState(true);
  const register = mode === 'register';
  const heading = register ? 'Đăng ký' : 'Đăng nhập';
  return <Screen testID={`screen-${mode}`} keyboard contentStyle={styles.form}>
    <View style={styles.logo}><Asset source={assets.bookOpen} width={30} /></View>
    <AppText size={30} weight="bold" accessibilityRole="header">{heading}</AppText>
    <View style={styles.credentials}>
      {register && <AppTextInput accessibilityLabel="Tên hiển thị" placeholder="Tên hiển thị"
        autoComplete="name" maxLength={100} editable={!form.pending} value={form.displayName}
        onChangeText={form.setDisplayName} icon={<Asset source={figmaAssets.home.userRound} width={22} />} />}
      <AppTextInput accessibilityLabel="Email" placeholder="Email" keyboardType="email-address"
        autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" maxLength={255}
        editable={!form.pending} value={form.email} onChangeText={form.setEmail}
        icon={<Asset source={assets.mail} width={22} />} />
      <AppTextInput accessibilityLabel="Mật khẩu" placeholder="Mật khẩu" secureTextEntry={hidePassword}
        autoCapitalize="none" autoCorrect={false} textContentType={register ? 'newPassword' : 'password'}
        maxLength={72} editable={!form.pending} value={form.password} onChangeText={form.setPassword}
        icon={<Asset source={assets.lockKeyhole} width={22} />}
        trailing={<Pressable accessibilityRole="button" accessibilityLabel={hidePassword ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
          onPress={() => setHidePassword(value => !value)} hitSlop={8}><Asset source={assets.eyeOff} width={19} /></Pressable>} />
      {register && <AppTextInput accessibilityLabel="Xác nhận mật khẩu" placeholder="Xác nhận mật khẩu"
        secureTextEntry={hidePassword} autoCapitalize="none" autoCorrect={false} textContentType="newPassword"
        maxLength={72} editable={!form.pending} value={form.confirmPassword} onChangeText={form.setConfirmPassword}
        icon={<Asset source={assets.lockKeyhole} width={22} />} />}
      {register && <AppText size={13} color={colors.muted}>Ít nhất 8 ký tự, có chữ và số.</AppText>}
      {!register && <Pressable accessibilityRole="button" onPress={() => notice('Khôi phục mật khẩu')} style={styles.recovery}>
        <AppText size={13} weight="semibold" color={colors.primary}>Quên mật khẩu?</AppText>
      </Pressable>}
      {state.status === 'signed-out' && state.message && !register && !form.error &&
        <AppText color={colors.muted}>{state.message}</AppText>}
      {!!form.error && <AppText accessibilityRole="alert" color={colors.error}>{form.error}</AppText>}
    </View>
    <PrimaryButton title={form.pending ? 'Đang xử lý…' : heading} disabled={form.pending}
      testID={`${mode}-submit`} onPress={() => void form.submit()} />
    {!register && <><View style={styles.dividerRow}>
      <View style={styles.divider} /><AppText size={13} color={colors.muted}>hoặc</AppText><View style={styles.divider} />
    </View>
    <View style={styles.socialGroup}>
      <Pressable accessibilityRole="button" onPress={() => notice('Đăng nhập Google')} style={styles.social}>
        <AppText size={24} weight="extrabold" color={colors.primary}>G</AppText>
        <AppText size={14} weight="semibold">Tiếp tục với Google</AppText>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => notice('Đăng nhập Apple')} style={styles.social}>
        <Asset source={assets.apple} width={22} />
        <AppText size={14} weight="semibold">Tiếp tục với Apple</AppText>
      </Pressable>
    </View></>}
    <View style={styles.signUp}>
      <AppText size={12} color={colors.muted}>{register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}</AppText>
      <Pressable accessibilityRole="link" disabled={form.pending}
        onPress={() => { if (register) router.replace('/login'); else router.push('/register'); }}>
        <AppText size={12} weight="bold" color={colors.primary}>{register ? 'Đăng nhập' : 'Đăng ký'}</AppText>
      </Pressable>
    </View>
  </Screen>;
}

export default function LoginScreen() {
  return <AuthScreen mode="login" />;
}

const styles = StyleSheet.create({
  form: { alignItems: 'center', gap: 27, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 22 },
  logo: { width: 50, height: 50, backgroundColor: colors.primary, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  credentials: { width: '100%', paddingTop: 15, gap: 16 },
  recovery: { alignSelf: 'flex-end', paddingTop: 3, minHeight: 19 },
  dividerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14 },
  divider: { flex: 1, height: 1, backgroundColor: colors.screenBorder },
  socialGroup: { width: '100%', gap: 12 },
  social: { minHeight: 54, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.screenBorder,
    borderRadius: 12, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  signUp: { paddingTop: 4, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 5 },
});
