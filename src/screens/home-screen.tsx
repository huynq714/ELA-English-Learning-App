import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BottomNavigation } from '@/components/bottom-navigation';
import { ActivityCard, AppCard, AppText, Asset, Screen } from '@/components/ui';
import { useSession } from '@/features/auth/view-model/session-context';
import { homeGreeting } from '@/features/home/greeting';
import { useReviewSummary } from '@/features/review/use-review-summary';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.home;

function StatisticCard({ id, value, label, icon, compact, onPress }:
  { id: string; value: number | string; label: string; icon: number; compact: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.metricPressable}>
    <AppCard style={[styles.metric, compact && styles.metricCompact]}>
      <Asset source={icon} width={31} />
      <View style={[styles.metricText, compact && styles.metricTextCompact]}>
        <AppText testID={`home-metric-${id}-value`} size={27} weight="extrabold"
          numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</AppText>
        <AppText testID={`home-metric-${id}-label`} size={11} weight="semibold"
          style={compact && styles.metricLabelCompact} color={colors.muted}>{label}</AppText>
      </View>
    </AppCard>
  </Pressable>;
}

export default function HomeScreen() {
  const [greeting, setGreeting] = useState(() => homeGreeting());
  useEffect(() => {
    const timer = setInterval(() => setGreeting(homeGreeting()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const { width, fontScale } = useWindowDimensions();
  const compactMetrics = width / fontScale < 400;
  const { state } = useSession();
  const { summary, pendingSessionId, error } = useReviewSummary();
  const landscapeWidth = Math.min(width, 480);
  if (state.status !== 'signed-in') return null;
  return <Screen testID="screen-home" footer={<BottomNavigation active="home" />}>
    <Asset source={assets.mountainLandscape} width={landscapeWidth} height={landscapeWidth * 268 / 375}
      style={styles.landscape} />
    <View style={styles.content}>
      <AppText size={19} weight="bold" accessibilityRole="header">{greeting.text}, {state.user.displayName}! {greeting.icon}</AppText>
      <View style={styles.breathingRoom} />
      <AppCard style={styles.streak}>
        <View style={styles.streakIcon}><Asset source={assets.flame} width={34} /></View>
        <View style={{ gap: 7 }}>
          <AppText size={31} weight="extrabold">{summary?.currentStreak ?? '–'}</AppText>
          <AppText size={13} weight="semibold" color={colors.muted}>Ngày học liên tiếp</AppText>
        </View>
      </AppCard>
      <View style={styles.metrics}>
        <StatisticCard id="learned" compact={compactMetrics} value={summary?.learnedCount ?? '–'} label="Đã học qua" icon={assets.bookOpen} onPress={() => router.navigate('/vocabulary')} />
        <StatisticCard id="due" compact={compactMetrics} value={summary?.dueCount ?? '–'} label="Đến hạn ôn" icon={assets.layers} onPress={() => router.push('/review')} />
        <StatisticCard id="cram" compact={compactMetrics} value={summary?.cramCount ?? '–'} label="Ôn thêm" icon={assets.bookOpen} onPress={() => router.push('/review')} />
      </View>
      <AppText size={19} weight="bold" accessibilityRole="header">Tiếp tục học</AppText>
      <View style={styles.activities}>
        <ActivityCard title="Ôn tập SRS" subtitle={pendingSessionId || summary?.activeSessionId ? 'Có phiên đang dở'
          : summary ? (summary.dueCount > 0 ? `${summary.dueCount} từ vựng đang chờ bạn` : 'Chưa có từ đến hạn')
          : error ? 'Chạm để thử lại' : 'Đang tải tiến độ'} icon={assets.alarmClock}
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
  metricCompact: { flex: 1, flexDirection: 'column', alignItems: 'center', paddingHorizontal: 8 },
  metricText: { flex: 1, minWidth: 0, gap: 7 },
  metricTextCompact: { flex: 0, width: '100%', alignItems: 'center' },
  metricLabelCompact: { textAlign: 'center' },
  activities: { gap: 13 },
});
