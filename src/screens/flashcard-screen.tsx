import { Pressable, StyleSheet, View } from 'react-native';

import { useDemoNotice } from '@/components/demo-notice';
import { AppHeader, AppText, Asset, ProgressBar, Screen } from '@/components/ui';
import { journey } from '@/data/demo';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.flashcard;
const ratings = [
  { label: 'Again', icon: assets.rotateCcw, background: colors.errorSurface, color: colors.error },
  { label: 'Hard', icon: assets.clock3, background: colors.warningSurface, color: colors.warning },
  { label: 'Good', icon: assets.checkCheck, background: colors.successSurface, color: colors.success },
  { label: 'Easy', icon: assets.calendarCheck, background: colors.lavender, color: colors.primary },
] as const;

function ListenButton() {
  const notice = useDemoNotice();
  return <Pressable accessibilityRole="button" accessibilityLabel="Nghe phát âm"
    hitSlop={7} onPress={() => notice('Phát âm thanh')} style={styles.listen}>
    <Asset source={assets.volume2} width={19} />
  </Pressable>;
}

function FlashcardCard() {
  return <View style={styles.wordCard}>
    <AppText size={39} weight="extrabold">{journey.word}</AppText>
    <View style={styles.pronunciation}>
      <AppText size={20} color={colors.muted}>{journey.ipa}</AppText><ListenButton />
    </View>
    <View style={styles.translation}>
      <View style={styles.languageBadge}><AppText size={13} color={colors.error}>★</AppText></View>
      <AppText size={15} style={{ flexShrink: 1 }}>{journey.meaning}</AppText>
    </View>
  </View>;
}

export default function FlashcardScreen() {
  const notice = useDemoNotice();
  return <Screen testID="screen-flashcard" contentStyle={styles.content}
    header={<AppHeader title="Học từ vựng" trailing={
      <AppText size={14} weight="semibold" color={colors.muted}>{journey.current}/{journey.total}</AppText>
    } />}>
    <ProgressBar value={journey.visualProgress} />
    <FlashcardCard />
    <View style={styles.example}>
      <AppText size={18} style={{ lineHeight: 28.8 }}>{journey.example}</AppText>
      <View style={styles.exampleListen}><ListenButton /></View>
    </View>
    {/* These ratings belong to SRS in the MVP; retain this Figma placement for Week 2. */}
    <View style={styles.ratings}>
      {ratings.map(rating => <Pressable key={rating.label} accessibilityRole="button"
        onPress={() => notice(`Đánh giá SRS: ${rating.label}`)}
        style={[styles.rating, { backgroundColor: rating.background }]}>
        <Asset source={rating.icon} width={23} />
        <AppText size={13} weight="bold" color={rating.color}>{rating.label}</AppText>
      </Pressable>)}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { minHeight: 600, paddingTop: 9, paddingHorizontal: 22, paddingBottom: 12, justifyContent: 'space-between', gap: 28 },
  wordCard: { paddingTop: 32, alignItems: 'center', gap: 25 },
  pronunciation: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  listen: { width: 30, height: 30, borderRadius: 100, backgroundColor: colors.lavender, justifyContent: 'center', alignItems: 'center' },
  translation: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 14, backgroundColor: colors.lavender, maxWidth: '100%' },
  languageBadge: { width: 24, height: 24, borderRadius: 100, backgroundColor: colors.errorSurface, alignItems: 'center', justifyContent: 'center' },
  example: { paddingHorizontal: 12, gap: 17 },
  exampleListen: { alignItems: 'flex-end' },
  ratings: { flexDirection: 'row', gap: 8 },
  rating: { flex: 1, minWidth: 0, minHeight: 90, paddingVertical: 12, gap: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
