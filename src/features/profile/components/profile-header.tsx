import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Asset } from '@/components/ui';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

export function ProfileHeader({ title, disabled = false }: { title: string; disabled?: boolean }) {
  return <View style={styles.header}>
    <Pressable testID="profile-back" accessibilityRole="button" accessibilityLabel="Quay lại" disabled={disabled}
      onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/home'); }} style={styles.back}>
      <Asset source={figmaAssets.home.chevronRight} width={17}
        style={{ tintColor: colors.textPrimary, transform: [{ rotate: '180deg' }] }} />
    </Pressable>
    <AppText accessibilityRole="header" size={22} weight="bold" color={colors.textPrimary}>{title}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 10, paddingTop: 8, paddingRight: 22 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
