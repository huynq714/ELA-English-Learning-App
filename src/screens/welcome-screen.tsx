import { router } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Asset, PrimaryButton, Screen } from '@/components/ui';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const illustrationWidth = Math.min(305, width - 48);
  return <Screen testID="screen-welcome" contentStyle={styles.content}>
    <Asset source={figmaAssets.welcome.learningIllustration} width={illustrationWidth}
      height={illustrationWidth * 320 / 305} label="Minh họa người học đang đọc sách" />
    <View style={styles.introduction}>
      <AppText accessibilityRole="header" size={31} weight="extrabold" style={styles.center}>English Learning App</AppText>
      <AppText size={16} color={colors.muted} style={[styles.center, { lineHeight: 25.6 }]}>
        Học từ vựng, luyện phát âm và giao tiếp với AI mỗi ngày.
      </AppText>
    </View>
    <Asset source={figmaAssets.welcome.pagination} width={40} height={8} label="Trang giới thiệu 1 trên 3" />
    <PrimaryButton title="Bắt đầu" testID="welcome-start" onPress={() => router.push('/login')} />
  </Screen>;
}

const styles = StyleSheet.create({
  content: { minHeight: 650, paddingTop: 46, paddingBottom: 25, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'space-between', gap: 24 },
  introduction: { width: '100%', alignItems: 'center', gap: 17 },
  center: { textAlign: 'center' },
});
