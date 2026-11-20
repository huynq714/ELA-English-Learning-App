import { Image } from 'expo-image';
import { router } from 'expo-router';
import { type PropsWithChildren, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Asset, PrimaryButton, Screen } from '@/components/ui';
import { useSession } from '@/features/auth/view-model/session-context';
import { ProfileHeader } from '@/features/profile/components/profile-header';
import { SuccessDialog } from '@/features/profile/components/success-dialog';
import { levelLabels, levels } from '@/features/profile/models/english-level';
import { useProfileViewModel } from '@/features/profile/view-model/use-profile-view-model';
import { figmaAssets } from '@/theme/figma-assets';
import { colors, fonts } from '@/theme/tokens';

export default function ProfileScreen() {
  const { state } = useSession();
  const profile = useProfileViewModel();
  const [editingLevel, setEditingLevel] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  if (state.status !== 'signed-in') return null;
  const disabled = !!profile.busy;

  const saveProfile = async () => {
    Keyboard.dismiss();
    setEditingLevel(false);
    if (await profile.save()) setShowSaved(true);
  };

  return <Screen testID="screen-profile" keyboard header={<ProfileHeader title="Chỉnh sửa hồ sơ" disabled={disabled} />}
    contentStyle={styles.content}>
    {profile.loading && <AppText color={colors.muted}>Đang tải hồ sơ…</AppText>}
    {profile.loadError && <>
      <AppText accessibilityRole="alert" color={colors.error}>{profile.loadError}</AppText>
      <PrimaryButton title="Thử lại" onPress={profile.retry} />
    </>}
    {!profile.loading && !profile.loadError && <>
      <Pressable accessibilityRole="button" accessibilityLabel="Thay đổi ảnh đại diện" disabled={disabled}
        onPress={() => void profile.selectAvatar()} style={styles.avatarAction} testID="profile-avatar">
        <View style={styles.avatar}>
          <Asset source={figmaAssets.home.userRound} width={40} style={{ tintColor: colors.primary }} />
          {profile.avatar && <Image source={profile.avatar} contentFit="cover" cachePolicy="none" style={styles.photo} />}
        </View>
        <AppText weight="semibold" color={colors.primary}>{profile.busy === 'avatar' ? 'Đang mở ảnh…' : 'Thay đổi ảnh'}</AppText>
      </Pressable>

      <Field label="Tên hiển thị">
        <TextInput accessibilityLabel="Tên hiển thị" maxLength={100} editable={!disabled}
          value={profile.displayName} onChangeText={profile.setDisplayName} style={[styles.field, styles.input]} />
      </Field>
      <Field label="Email tài khoản">
        <View style={styles.field}>
          <Asset source={figmaAssets.login.mail} width={20} />
          <AppText color={colors.textSecondary} style={styles.fieldText}>{state.user.email}</AppText>
        </View>
      </Field>
      <Field label="Trình độ tiếng Anh">
        <SelectRow label="Trình độ tiếng Anh" value={`${profile.level} — ${levelLabels[profile.level]}`}
          expanded={editingLevel} disabled={disabled} onPress={() => setEditingLevel(!editingLevel)} />
        {editingLevel && <View style={styles.options}>
          {levels.map(level => <Pressable accessibilityRole="button" key={level} disabled={disabled}
            accessibilityState={{ selected: level === profile.level }}
            style={[styles.option, level === profile.level && styles.selected]}
            onPress={() => { profile.setLevel(level); setEditingLevel(false); }}>
            <AppText color={level === profile.level ? colors.primary : colors.textPrimary}>{level} — {levelLabels[level]}</AppText>
          </Pressable>)}
        </View>}
      </Field>
      <AppText size={13} color={colors.textSecondary}>Cập nhật thông tin để việc học phù hợp hơn với bạn.</AppText>
      <SelectRow label="Đổi mật khẩu" value="Đổi mật khẩu" disabled={disabled} onPress={() => {
        Keyboard.dismiss();
        setEditingLevel(false);
        router.push('/change-password');
      }} />
      <PrimaryButton title={profile.busy === 'save' ? 'Đang lưu…' : 'Lưu thay đổi'} testID="profile-save"
        disabled={disabled} onPress={() => void saveProfile()} />
    </>}
    {profile.actionError && <AppText accessibilityRole="alert" color={colors.error}>{profile.actionError}</AppText>}
    <PrimaryButton title={profile.busy === 'logout' ? 'Đang đăng xuất…' : 'Đăng xuất'} testID="profile-logout"
      disabled={disabled} onPress={() => void profile.signOut()} />
    <SuccessDialog visible={showSaved} title="Thay đổi thành công" message="Hồ sơ của bạn đã được cập nhật."
      testID="profile-save-success" onClose={() => setShowSaved(false)} />
  </Screen>;
}

function Field({ label, children }: PropsWithChildren<{ label: string }>) {
  return <View style={styles.group}>
    <AppText size={14} weight="medium" color={colors.textPrimary}>{label}</AppText>
    {children}
  </View>;
}

function SelectRow({ label, value, expanded, disabled, onPress }: {
  label: string; value: string; expanded?: boolean; disabled: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label === value ? label : `${label}, ${value}`}
    accessibilityState={{ expanded, disabled }} disabled={disabled} onPress={onPress} style={styles.field}>
    <AppText color={colors.textPrimary} style={styles.fieldText}>{value}</AppText>
    <Asset source={figmaAssets.home.chevronRight} width={15}
      style={expanded ? { transform: [{ rotate: '90deg' }] } : undefined} />
  </Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24, gap: 18 },
  avatarAction: { alignSelf: 'center', alignItems: 'center', gap: 10, paddingTop: 6, paddingBottom: 10 },
  avatar: { backgroundColor: colors.primarySurface, width: 88, height: 88, borderRadius: 44,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photo: { position: 'absolute', width: 88, height: 88 },
  group: { gap: 7 },
  field: { minHeight: 52, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { fontSize: 15, fontFamily: fonts.regular, color: colors.textPrimary },
  fieldText: { flex: 1 },
  options: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 4, backgroundColor: colors.surface },
  option: { minHeight: 44, paddingHorizontal: 10, borderRadius: 7, justifyContent: 'center' },
  selected: { backgroundColor: colors.lavender },
});
