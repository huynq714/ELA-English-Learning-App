import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppHeader, AppText, Asset, PrimaryButton, Screen } from '@/components/ui';
import { ratings, type Rating } from '@/features/review/models';
import { useReviewSession } from '@/features/review/use-review-session';
import { StudyFlashcard } from '@/features/vocabulary/components/study-flashcard';
import { useFlashcardAudio } from '@/features/vocabulary/hooks/use-flashcard-audio';
import type { Word } from '@/features/vocabulary/models/word';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const ratingLabels: Record<Rating, string> = { AGAIN: 'Again', HARD: 'Hard', GOOD: 'Good', EASY: 'Easy' };
const ratingColors: Record<Rating, string> = { AGAIN: colors.error, HARD: '#8B4C09', GOOD: colors.primary, EASY: '#166653' };

function ReviewCard({ word, disabled, onRate }: { word: Word; disabled: boolean; onRate: (rating: Rating) => void }) {
  const audio = useFlashcardAudio(word.id);
  const [revealed, setRevealed] = useState(false);
  return <>
    <StudyFlashcard word={word} audio={audio} onReveal={setRevealed} />
    <View style={styles.ratings}>
      {ratings.map(rating => <Pressable key={rating} accessibilityRole="button"
        accessibilityLabel={ratingLabels[rating]} accessibilityState={{ disabled: disabled || !revealed }}
        disabled={disabled || !revealed} onPress={() => onRate(rating)}
        style={({ pressed }) => [styles.rating, { borderColor: ratingColors[rating] },
          (pressed || disabled || !revealed) && styles.dimmed]} testID={`review-rating-${rating}`}>
        <AppText size={14} weight="bold" color={ratingColors[rating]}>{ratingLabels[rating]}</AppText>
      </Pressable>)}
    </View>
  </>;
}

export default function ReviewSessionScreen({ sessionId }: { sessionId: string }) {
  const { data, pending, loading, error, reload, rate, retryRating } = useReviewSession(sessionId);
  const session = data?.session;
  const word = data?.words.find(item => item.id === session?.nextWordId);
  const nextItem = session?.items.find(item => item.wordId === session.nextWordId);
  const back = () => router.canGoBack() ? router.back() : router.replace('/review');
  const waitingAt = session?.nextDueAt ? new Date(session.nextDueAt).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) : null;
  const progress = session?.targetCount ? session.completedCount / session.targetCount : 0;

  return <Screen testID="screen-review-session" contentStyle={styles.content}
    header={<AppHeader title={session?.type === 'CRAM' ? 'Ôn tập tự nguyện' : 'Phiên ôn tập'}
      trailing={<Pressable accessibilityRole="button" accessibilityLabel="Về Ôn tập hôm nay" onPress={back} style={styles.back}>
        <Asset source={figmaAssets.home.chevronRight} width={16} style={styles.backIcon} />
      </Pressable>} />}>
    {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Đang đồng bộ phiên ôn" />}
    {error && <AppText accessibilityRole="alert" color={colors.error}>{error}</AppText>}
    {pending && <PrimaryButton title="Gửi lại đánh giá" testID="review-retry-rating" disabled={loading} onPress={retryRating} />}
    {!pending && error && <PrimaryButton title="Tải lại phiên ôn" disabled={loading} onPress={reload} />}
    {session && !session.empty && <>
      <View style={styles.progress}>
        <AppText weight="semibold">{session.completedCount}/{session.targetCount} từ hoàn thành</AppText>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: session.targetCount, now: session.completedCount }}
          style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
      {session.status === 'COMPLETED' && <View style={styles.summary} testID="review-complete">
        <AppText size={24} weight="bold" accessibilityRole="header">Đã hoàn thành phiên ôn</AppText>
        <AppText color={colors.muted}>Bạn đã ôn xong {session.completedCount} từ.</AppText>
        {!pending && <PrimaryButton title="Về Ôn tập hôm nay" onPress={back} />}
      </View>}
      {session.status === 'ABANDONED' && <PrimaryButton title="Về Ôn tập hôm nay" onPress={back} />}
      {session.status === 'IN_PROGRESS' && (session.waiting
        ? <View style={styles.summary} testID="review-waiting">
          <AppText size={21} weight="bold">Đang chờ lượt ôn tiếp theo</AppText>
          {waitingAt && <AppText color={colors.muted}>Có thể tiếp tục lúc {waitingAt}.</AppText>}
          {!error && <PrimaryButton title="Kiểm tra lại" disabled={loading} onPress={reload} />}
        </View>
        : word ? <ReviewCard key={`${word.id}:${nextItem?.dueAt}`} word={word} disabled={loading || !!pending} onRate={rate} />
        : <AppText accessibilityRole="alert" color={colors.error}>Chưa tải được nội dung thẻ.</AppText>)}
    </>}
    {session?.empty && <AppText color={colors.muted}>Phiên này không có từ để ôn.</AppText>}
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingVertical: 18, gap: 16 },
  back: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { transform: [{ rotate: '180deg' }] },
  progress: { gap: 8 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.screenBorder, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.primary },
  summary: { gap: 12, paddingVertical: 14 },
  ratings: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  rating: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    borderRadius: 8, backgroundColor: colors.surface },
  dimmed: { opacity: 0.5 },
});
