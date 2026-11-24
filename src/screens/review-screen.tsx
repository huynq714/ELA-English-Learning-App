import { router, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppHeader, AppText, Asset, PrimaryButton, Screen } from '@/components/ui';
import { useSession } from '@/features/auth/view-model/session-context';
import type { SessionType } from '@/features/review/models';
import { reviewError, reviewRepository } from '@/features/review/repository';
import { useReviewSummary } from '@/features/review/use-review-summary';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.review;

function ReviewProgress({ due }: { due: number }) {
  return <View style={styles.ring} accessible accessibilityLabel={`${due} từ cần ôn`}>
    <Asset source={assets.track} width={196} style={styles.track} />
    {/* The visible arc has its own exported bounds, inside the 196 px ring. */}
    {due > 0 && <Asset source={assets.completed} width={98.0002} height={191.204} style={styles.arc} />}
    <View style={styles.total}>
      <AppText size={40} weight="bold">{due}</AppText>
      <AppText size={13} color={colors.muted}>Từ cần ôn</AppText>
    </View>
  </View>;
}

export default function ReviewScreen() {
  const { authenticated } = useSession();
  const { summary, pendingSessionId, error, reload } = useReviewSummary();
  const starting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const resumeId = pendingSessionId ?? summary?.activeSessionId;
  const open = (id: string) => router.push(`/review-session?id=${encodeURIComponent(id)}` as Href);
  const start = async (type: SessionType) => {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setStartError(null);
    try {
      const { session } = await authenticated(token => reviewRepository.start(type, token));
      if (session.sessionId) open(session.sessionId);
      else { setStartError('Hiện chưa có từ đủ điều kiện cho phiên này.'); reload(); }
    } catch (failure) {
      setStartError(reviewError(failure));
    } finally {
      starting.current = false;
      setBusy(false);
    }
  };
  const categories = summary ? [
    { label: 'Từ mới', count: summary.newCount, icon: assets.flame },
    { label: 'Đang học', count: summary.learningCount + summary.relearningCount, icon: assets.bookOpen },
    { label: 'Đã thuộc', count: summary.reviewCount, icon: assets.badgeCheck },
  ] : [];
  return <Screen testID="screen-review" header={<AppHeader title="Ôn tập hôm nay" />} contentStyle={styles.content}>
    {!summary && !error && <ActivityIndicator accessibilityLabel="Đang tải dữ liệu ôn tập" color={colors.primary} />}
    {error && <View style={styles.notice}>
      <AppText accessibilityRole="alert" color={colors.error}>{error}</AppText>
      <PrimaryButton title="Thử lại" onPress={reload} />
    </View>}
    {summary && <>
      <ReviewProgress due={summary.dueCount} />
      <View style={styles.notice}>
        <AppText size={15} weight="semibold">{summary.currentStreak} ngày ôn liên tiếp</AppText>
        {resumeId ? <PrimaryButton title="Tiếp tục ôn tập" onPress={() => open(resumeId)} />
          : summary.dueCount > 0 ? <PrimaryButton title="Bắt đầu ôn tập" disabled={busy} onPress={() => void start('DUE')} />
          : summary.totalCards > 0 ? <PrimaryButton title="Ôn tập tự nguyện" disabled={busy} onPress={() => void start('CRAM')} />
          : <AppText color={colors.muted}>Hãy học một số từ bằng flashcard để bắt đầu ôn tập.</AppText>}
        {startError && <AppText accessibilityRole="alert" color={colors.error}>{startError}</AppText>}
      </View>
    </>}
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
  notice: { width: '100%', gap: 10 },
  content: { paddingTop: 32, paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center', gap: 31 },
  ring: { width: 196, height: 196 },
  track: { position: 'absolute', left: 0, top: 0 },
  arc: { position: 'absolute', left: 98, top: 0 },
  total: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center', gap: 4 },
  categories: { width: '100%', paddingTop: 12, gap: 10 },
  category: { minHeight: 66, paddingHorizontal: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 17,
    borderBottomWidth: 1, borderBottomColor: colors.screenBorder },
});
