import { StyleSheet, View } from 'react-native';

import { useDemoNotice } from '@/components/demo-notice';
import { AppHeader, AppText, Asset, PrimaryButton, Screen } from '@/components/ui';
import { learningSummary } from '@/data/demo';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.review;

function ReviewProgress() {
  return <View style={styles.ring} accessible accessibilityLabel={`${learningSummary.due} từ cần ôn`}>
    <Asset source={assets.track} width={196} style={styles.track} />
    {/* The visible arc has its own exported bounds, inside the 196 px ring. */}
    <Asset source={assets.completed} width={98.0002} height={191.204} style={styles.arc} />
    <View style={styles.total}>
      <AppText size={40} weight="bold">{learningSummary.due}</AppText>
      <AppText size={13} color={colors.muted}>Từ cần ôn</AppText>
    </View>
  </View>;
}

export default function ReviewScreen() {
  const notice = useDemoNotice();
  const categories = [
    { label: 'Từ mới', count: learningSummary.newWords, icon: assets.flame },
    { label: 'Đang học', count: learningSummary.learning, icon: assets.bookOpen },
    { label: 'Đã thuộc', count: learningSummary.mastered, icon: assets.badgeCheck },
  ];
  return <Screen testID="screen-review" header={<AppHeader title="Ôn tập hôm nay" />} contentStyle={styles.content}>
    <ReviewProgress />
    <PrimaryButton title="Bắt đầu ôn tập" onPress={() => notice('Phiên ôn tập SRS chi tiết')} />
    <View style={styles.categories}>
      {categories.map(category => <View key={category.label} style={styles.category}>
        <Asset source={category.icon} width={24} />
        <AppText size={17} weight="semibold" style={{ flex: 1 }}>{category.label}</AppText>
        <AppText size={18} color={colors.primary}>{category.count}</AppText>
      </View>)}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 32, paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center', gap: 31 },
  ring: { width: 196, height: 196 },
  track: { position: 'absolute', left: 0, top: 0 },
  arc: { position: 'absolute', left: 98, top: 0 },
  total: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center', gap: 4 },
  categories: { width: '100%', paddingTop: 12, gap: 10 },
  category: { minHeight: 66, paddingHorizontal: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 17,
    borderBottomWidth: 1, borderBottomColor: colors.screenBorder },
});
