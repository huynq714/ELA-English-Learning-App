import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { AppText, AppTextInput, Asset, PrimaryButton, Screen } from '@/components/ui';
import { usePasswordRecovery } from '@/features/auth/view-model/password-recovery';
import { validateNewPassword } from '@/features/auth/view-model/password-validation';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.login;
const titles = { email: 'Quên mật khẩu', otp: 'Xác minh mã OTP', password: 'Đặt mật khẩu mới' };

export function PasswordRecoveryScreen({ step }: { step: keyof typeof titles }) {
  const recovery = usePasswordRecovery();
  const { challenge, pending } = recovery;
  const error = recovery.error?.step === step ? recovery.error.message : undefined;
  const [email, setEmail] = useState(challenge?.email ?? '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [complete, setComplete] = useState(false);
  const [now, setNow] = useState(Date.now);
  const resendAt = challenge?.resendAt ?? 0;
  const seconds = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (step !== 'otp' || !resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step, resendAt]);

  if (!complete && step !== 'email' && (!challenge || (step === 'password' && !challenge.resetToken))) {
    return <Redirect href="/forgot-password" />;
  }

  async function submit() {
    Keyboard.dismiss();
    recovery.clearError();
    setFieldError(undefined);
    if (step === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setFieldError('Hãy nhập địa chỉ email hợp lệ.');
      if (await recovery.requestCode(email)) router.push('/verify-reset-otp');
    } else if (step === 'otp') {
      if (!/^\d{6}$/.test(otp)) return setFieldError('Hãy nhập mã OTP gồm 6 chữ số.');
      if (await recovery.verifyCode(otp)) {
        setOtp('');
        router.replace('/reset-password');
      }
    } else {
      const problem = validateNewPassword(password, confirmation);
      if (problem) return setFieldError(problem);
      if (await recovery.resetPassword(password, confirmation)) {
        setPassword('');
        setConfirmation('');
        setComplete(true);
        recovery.clear();
      }
    }
  }

  async function resend() {
    if (!challenge || Date.now() < resendAt) return;
    setFieldError(undefined);
    if (await recovery.requestCode(challenge.email, 'otp')) {
      setNow(Date.now());
      setOtp('');
    }
  }

  function backToLogin() {
    recovery.clear();
    router.dismissTo('/login');
  }

  return <Screen keyboard="scroll-insets" testID={`password-recovery-${step}`} contentStyle={styles.form}>
    <View style={styles.logo}><Asset source={assets.bookOpen} width={30} /></View>
    <AppText size={28} weight="bold" accessibilityRole="header" style={styles.center}>
      {complete ? 'Đổi mật khẩu thành công' : titles[step]}
    </AppText>
    <AppText size={14} color={colors.muted} style={styles.center}>
      {complete ? 'Bạn có thể đăng nhập lại bằng mật khẩu mới.'
        : step === 'email' ? 'Nhập email bạn đã dùng để đăng ký.'
          : step === 'otp' ? 'Nếu email đã được đăng ký, mã 6 số sẽ được gửi đến địa chỉ đó. Mã có hiệu lực 5 phút.'
            : 'Dùng ít nhất 8 ký tự, gồm cả chữ và số.'}
    </AppText>
    {complete ? <PrimaryButton title="Đăng nhập" onPress={backToLogin} /> : <>
      <View style={styles.fields}>
        {step === 'email' && <AppTextInput accessibilityLabel="Email" placeholder="Email" keyboardType="email-address"
          autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" maxLength={255} value={email}
          editable={!pending} onChangeText={setEmail} icon={<Asset source={assets.mail} width={22} />} />}
        {step === 'otp' && <AppTextInput accessibilityLabel="Mã OTP" placeholder="Mã OTP" keyboardType="number-pad"
          textContentType="oneTimeCode" maxLength={6} value={otp} editable={!pending}
          icon={<Asset source={assets.lockKeyhole} width={22} />}
          onChangeText={value => setOtp(value.replace(/[^0-9]/g, ''))} />}
        {step === 'password' && <>
          <AppTextInput accessibilityLabel="Mật khẩu mới" placeholder="Mật khẩu mới" textContentType="newPassword"
            autoCapitalize="none" autoCorrect={false} secureTextEntry={!showPasswords} maxLength={72} value={password}
            editable={!pending} onChangeText={setPassword} icon={<Asset source={assets.lockKeyhole} width={22} />}
            trailing={<Pressable accessibilityRole="button" accessibilityLabel={showPasswords ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              hitSlop={8} onPress={() => setShowPasswords(value => !value)}>
              <Asset source={assets.eyeOff} width={19} />
            </Pressable>} />
          <AppTextInput accessibilityLabel="Xác nhận mật khẩu" placeholder="Xác nhận mật khẩu"
            textContentType="newPassword" autoCapitalize="none" autoCorrect={false} secureTextEntry={!showPasswords}
            maxLength={72} value={confirmation} editable={!pending} onChangeText={setConfirmation}
            icon={<Asset source={assets.lockKeyhole} width={22} />} />
        </>}
        {(fieldError || error) && <AppText accessibilityRole="alert" color={colors.error}>{fieldError || error}</AppText>}
      </View>
      <PrimaryButton title={pending ? 'Đang xử lý…' : step === 'email' ? 'Gửi mã OTP' : step === 'otp' ? 'Xác minh' : 'Lưu mật khẩu'}
        disabled={pending} onPress={() => void submit()} />
      {step === 'otp' && <Pressable accessibilityRole="button" disabled={pending || seconds > 0} onPress={() => void resend()}>
        <AppText size={14} color={seconds > 0 ? colors.muted : colors.primary}>
          {seconds > 0 ? `Gửi lại mã sau ${seconds} giây` : 'Gửi lại mã'}
        </AppText>
      </Pressable>}
      {step !== 'email' && <Pressable accessibilityRole="link" disabled={pending} onPress={() => {
        recovery.clearError();
        router.dismissTo('/forgot-password');
      }}><AppText size={14} color={colors.primary}>{step === 'otp' ? 'Dùng email khác' : 'Yêu cầu mã mới'}</AppText></Pressable>}
      <Pressable accessibilityRole="link" disabled={pending} onPress={backToLogin}>
        <AppText size={14} weight="semibold" color={colors.primary}>Quay lại đăng nhập</AppText>
      </Pressable>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  form: { alignItems: 'center', gap: 22, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 22 },
  logo: { width: 50, height: 50, backgroundColor: colors.primary, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  fields: { width: '100%', gap: 16 },
});
