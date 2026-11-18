import { apiClient } from '@/services/api-client';
import { parseWord, type Word } from '../models/word';

async function getDeckWords(deckId: string): Promise<Word[]> {
  const payload = await apiClient.get<unknown>(`/api/v1/decks/${encodeURIComponent(deckId)}/words`);
  if (!Array.isArray(payload)) throw new Error('Backend returned an invalid word list.');
  return payload.map(parseWord);
}

export const wordRepository = { getDeckWords };
