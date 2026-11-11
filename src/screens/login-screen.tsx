import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useDemoNotice } from '@/components/demo-notice';
import { AppText, AppTextInput, Asset, PrimaryButton, Screen } from '@/components/ui';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.login;

export default function LoginScreen() {
  const notice = useDemoNotice();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return <Screen testID="screen-login" keyboard contentStyle={styles.form}>
    <View style={styles.logo}><Asset source={assets.bookOpen} width={30} /></View>
    <AppText size={30} weight="bold" accessibilityRole="header">Đăng nhập</AppText>
    <View style={styles.credentials}>
      <AppTextInput accessibilityLabel="Email" placeholder="Email" keyboardType="email-address"
        autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" value={email} onChangeText={setEmail}
        icon={<Asset source={assets.mail} width={22} />} />
      <AppTextInput accessibilityLabel="Mật khẩu" placeholder="Mật khẩu" secureTextEntry
        autoCapitalize="none" autoCorrect={false} textContentType="password" value={password} onChangeText={setPassword}
        icon={<Asset source={assets.lockKeyhole} width={22} />} trailing={<Asset source={assets.eyeOff} width={19} />} />
      <Pressable accessibilityRole="button" onPress={() => notice('Khôi phục mật khẩu')} style={styles.recovery}>
        <AppText size={13} weight="semibold" color={colors.primary}>Quên mật khẩu?</AppText>
      </Pressable>
    </View>
    <PrimaryButton title="Đăng nhập" testID="login-submit" onPress={() => router.replace('/home')} />
    <View style={styles.dividerRow}>
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
    </View>
    <View style={styles.signUp}>
      <AppText size={12} color={colors.muted}>Chưa có tài khoản?</AppText>
      <Pressable accessibilityRole="button" onPress={() => notice('Màn hình Đăng ký')}>
        <AppText size={12} weight="bold" color={colors.primary}>Đăng ký</AppText>
      </Pressable>
    </View>
  </Screen>;
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
