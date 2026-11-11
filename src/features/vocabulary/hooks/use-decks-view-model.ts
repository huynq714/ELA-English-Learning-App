import { useCallback, useEffect, useState } from 'react';

import { deckRepository } from '../repositories/deck-repository';
import type { Deck } from '../models/deck';

export function useDecksViewModel() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    deckRepository.getPublishedDecks().then(
      loadedDecks => {
        if (!cancelled) setDecks(loadedDecks);
      },
      reason => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách bộ từ.');
        }
      },
    ).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      setDecks(await deckRepository.getPublishedDecks());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách bộ từ.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return { decks, isLoading, isRefreshing, error, refresh };
}
