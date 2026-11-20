import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { savedWordRepository, type SavedLevel } from '../repositories/saved-word-repository';
import { useVocabularyQuery } from './use-vocabulary-query';

export function useMyVocabulary() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<SavedLevel>('');
  const loadGroups = useCallback((token: string) => savedWordRepository.groups(token, query), [query]);
  const loadCount = useCallback((token: string) => savedWordRepository.count(token), []);
  const groups = useVocabularyQuery(`saved-groups:${query}`, loadGroups);
  const count = useVocabularyQuery('saved-count', loadCount);

  useEffect(() => {
    const text = search.trim();
    if (text === query) return;
    const timer = setTimeout(() => setQuery(text), 250);
    return () => clearTimeout(timer);
  }, [search, query]);

  const refreshGroups = groups.refresh;
  const refreshCount = count.refresh;
  useFocusEffect(useCallback(() => {
    refreshGroups();
    refreshCount();
  }, [refreshGroups, refreshCount]));

  return {
    search,
    setSearch,
    level,
    setLevel,
    groups: groups.data ?? [],
    totalSaved: count.data?.total,
    error: groups.error ?? count.error,
    isLoading: groups.isLoading || count.isLoading,
    isRefreshing: groups.isRefreshing || count.isRefreshing,
    isSearching: search.trim() !== query,
    refresh: () => { refreshGroups(); refreshCount(); },
  };
}
