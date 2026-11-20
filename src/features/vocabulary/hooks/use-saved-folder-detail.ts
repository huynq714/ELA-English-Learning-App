import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { savedWordRepository } from '../repositories/saved-word-repository';
import { useSavedWordAction } from './use-saved-word-action';
import { useVocabularyQuery } from './use-vocabulary-query';

export function useSavedFolderDetail(groupId: string) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const loadGroup = useCallback((token: string) => savedWordRepository.group(token, groupId), [groupId]);
  const loadWords = useCallback((token: string) => savedWordRepository.list(token, query, '', 0, 100, groupId), [groupId, query]);
  const group = useVocabularyQuery(`saved-folder:${groupId}`, loadGroup);
  const words = useVocabularyQuery(`saved-folder-words:${groupId}:${query}`, loadWords);
  const action = useSavedWordAction();

  useEffect(() => {
    const text = search.trim();
    if (text === query) return;
    const timer = setTimeout(() => setQuery(text), 250);
    return () => clearTimeout(timer);
  }, [search, query]);

  const refreshGroup = group.refresh;
  const refreshWords = words.refresh;
  useFocusEffect(useCallback(() => {
    refreshGroup();
    refreshWords();
  }, [refreshGroup, refreshWords]));

  async function remove(wordId: string) {
    const removed = await action.change(wordId, false);
    if (removed) {
      refreshGroup();
      refreshWords();
    }
  }

  return {
    group: group.data,
    words: words.data?.words ?? [],
    search,
    setSearch,
    error: group.error ?? words.error,
    groupError: group.error,
    isLoading: group.isLoading || words.isLoading,
    isRefreshing: group.isRefreshing || words.isRefreshing,
    isSearching: search.trim() !== query,
    pendingId: action.pendingId,
    actionError: action.error,
    refresh: () => { refreshGroup(); refreshWords(); },
    remove,
  };
}
