import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors } from '@/theme/tokens';
import { useSavedWordAction } from '../hooks/use-saved-word-action';
import { useVocabularyQuery } from '../hooks/use-vocabulary-query';
import { savedWordRepository } from '../repositories/saved-word-repository';

export function BookmarkWord({ wordId }: { wordId: string }) {
  const load = useCallback((token: string) => savedWordRepository.status(token, wordId), [wordId]);
  const { data, error, isLoading, isRefreshing, refresh } = useVocabularyQuery(`bookmark:${wordId}`, load);
  const mutation = useSavedWordAction();
  useFocusEffect(refresh);
  const busy = isLoading || isRefreshing || !!mutation.pendingId;
  const label = error ? 'Tải lại trạng thái từ đã lưu' : data?.saved ? 'Bỏ lưu từ' : 'Lưu từ';

  async function toggle() {
    if (error) {
      refresh();
      return;
    }
    if (!data) return;
    await mutation.change(wordId, !data.saved);
    refresh();
  }

  return <View style={styles.container}>
    <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={busy}
      accessibilityState={{ busy, selected: data?.saved ?? false }} testID="flashcard-bookmark"
      style={styles.bookmark} onPress={() => void toggle()}>
      {busy ? <ActivityIndicator color={colors.primary} />
        : <AppText size={24} color={colors.primary} weight="semibold">{data?.saved ? '★' : '☆'}</AppText>}
    </Pressable>
    {(mutation.error || error) && <AppText size={13} accessibilityRole="alert" color={colors.error}>
      {mutation.error ?? 'Chưa tải được trạng thái lưu từ.'}
    </AppText>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 4, alignItems: 'flex-end' },
  bookmark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
