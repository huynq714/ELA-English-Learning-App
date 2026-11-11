import { router } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BottomNavigation } from '@/components/bottom-navigation';
import { ActivityCard, AppCard, AppText, Asset, Screen } from '@/components/ui';
import { learningSummary } from '@/data/demo';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.home;

function StatisticCard({ value, label, icon, onPress }:
  { value: number; label: string; icon: number; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.metricPressable}>
    <AppCard style={styles.metric}>
      <Asset source={icon} width={31} />
      <View style={styles.metricText}>
        <AppText size={27} weight="extrabold">{value}</AppText>
        <AppText size={11} weight="semibold" color={colors.muted}>{label}</AppText>
      </View>
    </AppCard>
  </Pressable>;
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const landscapeWidth = Math.min(width, 480);
  return <Screen testID="screen-home" footer={<BottomNavigation active="home" />}>
    <Asset source={assets.mountainLandscape} width={landscapeWidth} height={landscapeWidth * 268 / 375}
      style={styles.landscape} />
    <View style={styles.content}>
      <AppText size={19} weight="bold" accessibilityRole="header">Chào buổi sáng, {learningSummary.learner}! ☀️</AppText>
      <View style={styles.breathingRoom} />
      <AppCard style={styles.streak}>
        <View style={styles.streakIcon}><Asset source={assets.flame} width={34} /></View>
        <View style={{ gap: 7 }}>
          <AppText size={31} weight="extrabold">{learningSummary.streak}</AppText>
          <AppText size={13} weight="semibold" color={colors.muted}>Ngày học liên tiếp</AppText>
        </View>
      </AppCard>
      <View style={styles.metrics}>
        <StatisticCard value={learningSummary.learned} label="Từ đã học" icon={assets.bookOpen} onPress={() => router.navigate('/vocabulary')} />
        <StatisticCard value={learningSummary.due} label="Từ cần ôn" icon={assets.layers} onPress={() => router.push('/review')} />
      </View>
      <AppText size={19} weight="bold" accessibilityRole="header">Tiếp tục học</AppText>
      <View style={styles.activities}>
        <ActivityCard title="Ôn tập SRS" subtitle="24 từ vựng đang chờ bạn" icon={assets.alarmClock}
          chevron={assets.chevronRight} onPress={() => router.push('/review')} />
        <ActivityCard title="Hội thoại cùng AI" subtitle="Chủ đề: Food & Travel" icon={assets.messageSquare}
          chevron={assets.chevronRight} onPress={() => router.navigate('/ai')} />
      </View>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  landscape: { position: 'absolute', left: 0, top: 0 },
  content: { paddingTop: 17, paddingHorizontal: 22, paddingBottom: 20, gap: 18 },
  breathingRoom: { height: 49 },
  streak: { minHeight: 94, paddingHorizontal: 19, paddingVertical: 16, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 17 },
  streakIcon: { width: 48, height: 52, borderRadius: 15, backgroundColor: colors.warningSurface, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', gap: 12 },
  metricPressable: { flex: 1, minWidth: 0 },
  metric: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14 },
  metricText: { flex: 1, minWidth: 0, gap: 7 },
  activities: { gap: 13 },
});
