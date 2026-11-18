import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';
import { AppText, Asset } from './ui';

type Tab = 'home' | 'vocabulary' | 'ipa' | 'ai' | 'profile';
const tabs = [
  { key: 'home', label: 'Trang chủ', route: '/home' },
  { key: 'vocabulary', label: 'Từ vựng', route: '/vocabulary' },
  { key: 'ipa', label: 'IPA', route: '/ipa' },
  { key: 'ai', label: 'AI chat', route: '/ai' },
  { key: 'profile', label: 'Cá nhân', route: '/profile' },
] as const;

export function BottomNavigation({ active }: { active: Tab }) {
  const assets = figmaAssets[active === 'profile' ? 'home' : active];
  const sources = [assets.house, active === 'home' ? figmaAssets.home.bookOpen1 : assets.bookOpen,
    assets.mic, assets.messageCircle, assets.userRound];
  return <View style={styles.bar} accessibilityRole="tablist">
    {tabs.map((tab, index) => <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.label}
      accessibilityState={{ selected: active === tab.key }} testID={`tab-${tab.key}`}
      onPress={() => { if (tab.key !== active) router.navigate(tab.route); }}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
      <Asset source={sources[index]} width={22} />
      <AppText size={10} weight={active === tab.key ? 'bold' : 'medium'}
        color={active === tab.key ? colors.primary : colors.muted} style={styles.label}>{tab.label}</AppText>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  bar: { minHeight: 65, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 18,
    paddingHorizontal: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.screenBorder },
  item: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  label: { textAlign: 'center' },
});
