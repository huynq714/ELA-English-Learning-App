import { useCallback } from 'react';

import { wordRepository } from '../repositories/word-repository';
import { useVocabularyQuery } from './use-vocabulary-query';

export function useDeckWordsViewModel(deckId: string | undefined) {
  const load = useCallback((token: string) => wordRepository.getDeckWords(token, deckId ?? ''), [deckId]);
  const query = useVocabularyQuery(deckId, load);
  return {
    words: query.data ?? [],
    isLoading: query.isLoading,
    isRefreshing: query.isRefreshing,
    error: deckId ? query.error?.message ?? null : 'Missing deck ID. Open this screen from the Vocabulary list.',
    refresh: query.refresh,
  };
}
