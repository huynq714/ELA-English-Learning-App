import { apiClient } from '@/services/api-client';
import { parseDeck, type Deck } from '../models/deck';

async function getPublishedDecks(): Promise<Deck[]> {
  const payload = await apiClient.get<unknown>('/api/v1/decks');
  if (!Array.isArray(payload)) {
    throw new Error('Backend trả về danh sách bộ từ không hợp lệ.');
  }
  return payload.map(parseDeck);
}

export const deckRepository = { getPublishedDecks };
