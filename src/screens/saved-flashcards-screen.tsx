import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader, AppText, PrimaryButton, ProgressBar, Screen } from '@/components/ui';
import { FlashcardSources } from '@/features/vocabulary/components/flashcard-sources';
import { BookmarkWord } from '@/features/vocabulary/components/bookmark-word';
import { StudyFlashcard } from '@/features/vocabulary/components/study-flashcard';
import { useFlashcardAudio } from '@/features/vocabulary/hooks/use-flashcard-audio';
import { useVocabularyQuery } from '@/features/vocabulary/hooks/use-vocabulary-query';
import { savedWordRepository } from '@/features/vocabulary/repositories/saved-word-repository';
import { colors } from '@/theme/tokens';

export default function SavedFlashcardsScreen() {
  const params = useLocalSearchParams<{ groupId?: string; level?: string; wordId?: string }>();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const requestedLevel = Array.isArray(params.level) ? params.level[0] : params.level;
  const requestedWordId = Array.isArray(params.wordId) ? params.wordId[0] : params.wordId;
  const level = requestedLevel === 'A1' || requestedLevel === 'A2' ? requestedLevel : '';
  const [offset, setOffset] = useState(0);
  const load = useCallback((token: string) => savedWordRepository.forReview(token, groupId, level), [groupId, level]);
  const request = useVocabularyQuery(`saved-flashcards:${groupId ?? 'all'}:${level || 'all'}`, load);
  const words = request.data ?? [];
  const selectedIndex = requestedWordId ? words.findIndex(item => item.id === requestedWordId) : 0;
  const index = Math.max(0, selectedIndex) + offset;
  const word = words[index];
  const audio = useFlashcardAudio(word?.id ?? '');
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/my-vocabulary');
  };

  function next() {
    audio.stopPlayback();
    setOffset(value => value + 1);
  }

  return <Screen testID="screen-saved-flashcards" contentStyle={styles.content}
    header={<View>
      <AppHeader title="Ôn từ đã lưu" trailing={<Pressable accessibilityRole="button" style={styles.back} onPress={back}>
        <AppText color={colors.primary} weight="semibold">Quay lại</AppText>
      </Pressable>} />
      {word && <View style={styles.progressRow}>
        <View style={styles.progress}><ProgressBar value={(index + 1) / words.length} /></View>
        <FlashcardSources key={word.id} word={word} />
      </View>}
    </View>}
    footer={word && <View style={styles.controls}>
      <PrimaryButton title={index + 1 < words.length ? 'Từ tiếp theo' : 'Kết thúc'} onPress={next} />
    </View>}>
    {(request.isLoading || request.isRefreshing) && <AppText color={colors.muted}>Đang tải từ đã lưu…</AppText>}
    {request.error && <View style={styles.controls}>
      <AppText accessibilityRole="alert" color={colors.error}>Chưa tải được từ để ôn tập.</AppText>
      <PrimaryButton title="Thử lại" onPress={request.refresh} />
    </View>}
    {word && <StudyFlashcard key={word.id} word={word} audio={audio}
      bookmark={<BookmarkWord wordId={word.id} />} />}
    {!!request.data && !word && <View style={styles.controls}>
      <AppText weight="bold">{words.length ? 'Đã xem hết từ đã lưu' : 'Chưa có từ đã lưu'}</AppText>
      <PrimaryButton title="Về bộ từ của tôi" onPress={back} />
    </View>}
  </Screen>;
}

const styles = StyleSheet.create({
  content: { padding: 22, gap: 14 },
  progressRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, gap: 8 },
  progress: { flex: 1 },
  back: { minHeight: 44, justifyContent: 'center' },
  controls: { padding: 14, gap: 12 },
});
