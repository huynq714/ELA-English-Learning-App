import { apiClient } from '@/services/api-client';
import { parseWord, type Word } from '../models/word';

export type SavedLevel = '' | 'A1' | 'A2';
export type SavedGroup = {
  groupId: string;
  title: string;
  topic: string;
  level: string;
  description: string | null;
  wordCount: number;
  previewWords: string;
};
const path = '/api/v1/my-vocabulary';
const wordPath = (id: string) => `${path}/${encodeURIComponent(id)}`;

async function list(token: string, query: string, level: SavedLevel, page: number, size = 20, groupId?: string) {
  const result = await apiClient.get<{ items: { saved: boolean; word: unknown }[]; total: number; hasNext: boolean }>(
    `${path}?query=${encodeURIComponent(query)}&level=${level}&page=${page}&size=${size}${groupId ? `&groupId=${encodeURIComponent(groupId)}` : ''}`, token,
  );
  return { words: result.items.map(item => parseWord(item.word)), total: result.total, hasNext: result.hasNext };
}

async function forReview(token: string, groupId?: string, level: SavedLevel = '') {
  const words = new Map<string, Word>();
  let page = 0;
  let result;
  do {
    result = await list(token, '', level, page++, 100, groupId);
    for (const word of result.words) words.set(word.id, word);
  } while (result.hasNext);
  return [...words.values()];
}

export const savedWordRepository = {
  list, forReview,
  groups: (token: string, query: string) => apiClient.get<SavedGroup[]>(`${path}/groups?query=${encodeURIComponent(query)}`, token),
  group: (token: string, groupId: string) => apiClient.get<SavedGroup>(`${path}/groups/${encodeURIComponent(groupId)}`, token),
  count: (token: string) => apiClient.get<{ total: number }>(`${path}/count`, token),
  status: (token: string, id: string) => apiClient.get<{ saved: boolean }>(wordPath(id), token),
  save: (token: string, id: string) => apiClient.post<void>(wordPath(id), undefined, token),
  remove: (token: string, id: string) => apiClient.delete<void>(wordPath(id), token),
};
