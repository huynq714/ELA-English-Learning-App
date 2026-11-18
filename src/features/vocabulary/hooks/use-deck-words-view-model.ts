import { useCallback, useEffect, useState } from 'react';

import { wordRepository } from '../repositories/word-repository';
import type { Word } from '../models/word';

export function useDeckWordsViewModel(deckId: string | undefined) {
  const [words, setWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!deckId) {
      setWords([]);
      setError('Missing deck ID. Open this screen from the Vocabulary list.');
      setIsLoading(false);
      return;
    }
    setIsRefreshing(true);
    setError(null);
    try {
      setWords(await wordRepository.getDeckWords(deckId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load deck words.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [deckId]);

  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    wordRepository.getDeckWords(deckId).then(
      loaded => { if (!cancelled) setWords(loaded); },
      reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load deck words.'); },
    ).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [deckId]);
  return {
    words,
    isLoading: deckId ? isLoading : false,
    isRefreshing,
    error: deckId ? error : 'Missing deck ID. Open this screen from the Vocabulary list.',
    refresh,
  };
}
