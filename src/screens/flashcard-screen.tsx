import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Asset, PrimaryButton, ProgressBar, Screen } from '@/components/ui';
import { StudyFlashcard } from '@/features/vocabulary/components/study-flashcard';
import { useDeckWordsViewModel } from '@/features/vocabulary/hooks/use-deck-words-view-model';
import { useStudyProgress } from '@/features/vocabulary/hooks/use-study-progress';
import { verifiedVietnamese } from '@/features/vocabulary/models/word';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.flashcard;
const ratings = [
  { label: 'Again', icon: assets.rotateCcw, background: colors.errorSurface, color: colors.error },
  { label: 'Hard', icon: assets.clock3, background: colors.warningSurface, color: colors.warning },
  { label: 'Good', icon: assets.checkCheck, background: colors.successSurface, color: colors.success },
  { label: 'Easy', icon: assets.calendarCheck, background: colors.lavender, color: colors.primary },
] as const;

type Rating = typeof ratings[number]['label'];

export default function FlashcardScreen() {
  const params = useLocalSearchParams<{ deckId?: string; deckTitle?: string }>();
  const deckId = Array.isArray(params.deckId) ? params.deckId[0] : params.deckId;
  const deckTitle = Array.isArray(params.deckTitle) ? params.deckTitle[0] : params.deckTitle;
  const { words, isLoading, isRefreshing, error, refresh } = useDeckWordsViewModel(deckId);
  const learning = useStudyProgress(deckId);
  const [ratedIds, setRatedIds] = useState<Set<string>>(() => new Set());
  const [deferredIds, setDeferredIds] = useState<string[]>([]);
  const [cardTurn, setCardTurn] = useState(0);
  const [finished, setFinished] = useState(false);
  const [speechFailed, setSpeechFailed] = useState(false);
  const speechVersion = useRef(0);

  const stopSpeech = useCallback(() => {
    speechVersion.current++;
    void Speech.stop().catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => stopSpeech, [stopSpeech]));

  const requiredIds = new Set([
    ...(learning.progress?.unstudiedWordIds ?? []),
    ...(learning.progress?.remainingReviewWordIds ?? []),
  ]);
  const loading = isLoading || (learning.loading && !learning.progress);
  const unavailable = !!error || !!learning.loadError;
  const done = finished && requiredIds.size === 0 && !learning.loading;
  const remaining = words.filter(item => requiredIds.size ? requiredIds.has(item.id) : !ratedIds.has(item.id));
  const next = remaining.find(item => !deferredIds.includes(item.id))
    ?? deferredIds.map(id => remaining.find(item => item.id === id)).find(item => item !== undefined);
  const card = loading || unavailable || done ? undefined : next;

  const saveRating = async (wordId: string) => {
    const saved = await learning.study(wordId);
    if (!saved) return;
    setRatedIds(previous => new Set(previous).add(wordId));
    setDeferredIds(previous => previous.filter(id => id !== wordId));
    if (remaining.length === 1 && !saved.unstudiedWordIds.length && !saved.remainingReviewWordIds.length) {
      setFinished(true);
    }
  };

  const rate = (rating: Rating) => {
    if (!card || learning.pending || learning.unsavedWordId) return;
    stopSpeech();
    setSpeechFailed(false);
    if (rating === 'Again') {
      setDeferredIds(previous => [...previous.filter(id => id !== card.id), card.id]);
      setCardTurn(previous => previous + 1);
    } else {
      void saveRating(card.id);
    }
  };

  const speak = async (text: string) => {
    const version = ++speechVersion.current;
    const showError = () => {
      if (version === speechVersion.current) setSpeechFailed(true);
    };
    setSpeechFailed(false);
    try {
      await Speech.stop();
      if (version === speechVersion.current) {
        Speech.speak(text, { language: 'en-US', onError: showError });
      }
    } catch {
      showError();
    }
  };

  const backToVocabulary = () => router.dismissTo('/vocabulary');

  return <Screen testID="screen-flashcard" contentStyle={styles.content}
    header={(card || done) && <View style={styles.progress}>
      <ProgressBar value={done ? 1 : (words.length - remaining.length + 1) / words.length} />
    </View>}
    footer={card && <View style={styles.ratings}>
      {ratings.map(({ label, icon, background, color }) => <Pressable key={label} accessibilityRole="button"
        disabled={learning.pending || !!learning.unsavedWordId} onPress={() => rate(label)}
        style={({ pressed }) => [styles.rating, { backgroundColor: background }, pressed && styles.pressed]}>
        <Asset source={icon} width={24} />
        <AppText size={14} weight="bold" color={color}>{label}</AppText>
      </Pressable>)}
    </View>}>
    {loading && <AppText color={colors.muted}>Đang tải bộ thẻ…</AppText>}
    {unavailable && <View style={styles.state}>
      <AppText accessibilityRole="alert" color={colors.error}>{learning.loadError || 'Chưa tải được bộ thẻ.'}</AppText>
      <PrimaryButton title={learning.notFound ? 'Về Từ vựng' : 'Thử lại'}
        onPress={learning.notFound ? backToVocabulary : () => {
          if (error) void refresh();
          if (learning.loadError) learning.retryLoad();
        }} />
    </View>}
    {!loading && !unavailable && words.length === 0 && <View style={styles.state}>
      <AppText weight="semibold">Bộ từ này chưa có thẻ</AppText>
      <PrimaryButton title={isRefreshing ? 'Đang tải lại…' : 'Tải lại'} disabled={isRefreshing} onPress={() => void refresh()} />
    </View>}
    {card && <StudyFlashcard key={`${card.id}:${cardTurn}`} word={card} onSpeak={text => void speak(text)} speechFailed={speechFailed} />}
    {learning.unsavedWordId && <View style={styles.state}>
      <AppText accessibilityRole="alert" color={colors.error}>Chưa lưu được lượt học.</AppText>
      <PrimaryButton title="Thử lưu lại" disabled={learning.pending}
        onPress={() => void saveRating(learning.unsavedWordId!)} />
    </View>}
    {done && !loading && !unavailable && <View style={styles.completed} testID="flashcards-completed">
      <AppText size={27} weight="bold">Đã học xong</AppText>
      {deckTitle && <AppText color={colors.textSecondary} style={styles.center}>{deckTitle}</AppText>}
      {deckId && words.filter(verifiedVietnamese).length >= 5 && <PrimaryButton title="Làm Quiz"
        testID="flashcard-start-quiz"
        onPress={() => router.push({ pathname: '/quiz', params: { deckId, deckTitle: deckTitle ?? '' } })} />}
      <Pressable accessibilityRole="button" onPress={backToVocabulary} style={styles.back}>
        <AppText color={colors.primary} weight="semibold">Về Từ vựng</AppText>
      </Pressable>
    </View>}
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingVertical: 14, gap: 14 },
  progress: { paddingHorizontal: 22, paddingTop: 10 },
  state: { gap: 12, paddingVertical: 12 },
  center: { textAlign: 'center' },
  ratings: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingBottom: 12 },
  rating: { flex: 1, minWidth: 0, minHeight: 90, paddingVertical: 12, gap: 9, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
  completed: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 17, paddingBottom: 28 },
  back: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
