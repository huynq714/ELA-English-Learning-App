import { useState } from 'react';

import { deckRepository } from '../repositories/deck-repository';
import { useVocabularyQuery } from './use-vocabulary-query';

const searchKey = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('vi');

export function useDecksViewModel() {
  const { data, isLoading, isRefreshing, error, refresh } = useVocabularyQuery('decks', deckRepository.getPublishedDecks);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(0);
  const [topicKey, setTopicKey] = useState<string | null>(null);

  const allDecks = data ?? [];
  const topics = Array.from(new Map(allDecks.map(deck => [deck.topicKey, deck.topic])), ([key, label]) => ({ key, label }));
  const selectedTopic = tab === 1 && topics.some(topic => topic.key === topicKey) ? topicKey : null;
  const query = searchKey(search);
  const decks = allDecks.filter(deck => (!selectedTopic || deck.topicKey === selectedTopic)
    && (searchKey(deck.title).includes(query) || searchKey(deck.topic).includes(query)));

  return {
    decks, topics, isLoading, isRefreshing, refresh, search, setSearch, tab, setTab, selectedTopic, setTopicKey,
    hasCatalogue: allDecks.length > 0,
    needsProfileLevel: error?.code === 'PROFILE_LEVEL_REQUIRED',
    error: error?.message ?? null,
  };
}
