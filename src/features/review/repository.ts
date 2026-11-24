import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { parseWord } from '@/features/vocabulary/models/word';
import { ApiError, apiClient } from '@/services/api-client';
import { ratings, type PendingRating, type ReviewSession, type ReviewSessionData, type ReviewSummary, type SessionType } from './models';

const path = '/api/v1/review';
const sessionPath = (id: string) => `${path}/session/${encodeURIComponent(id)}`;

function parseSession(data: { session: ReviewSession; words: unknown[] }): ReviewSessionData {
  return { session: data.session, words: data.words.map(parseWord) };
}

export const reviewRepository = {
  summary: (token: string) => apiClient.get<ReviewSummary>(`${path}/summary`, token),
  start: async (type: SessionType, token: string) => parseSession(
    await apiClient.post<Parameters<typeof parseSession>[0]>(`${path}/session/start`, { type }, token)),
  session: async (id: string, token: string) => parseSession(
    await apiClient.get<Parameters<typeof parseSession>[0]>(sessionPath(id), token)),
  rate: ({ sessionId, ...body }: PendingRating, token: string) =>
    apiClient.post<unknown>(`${sessionPath(sessionId)}/rate`, body, token),
};

const keyFor = (userId: string) => `ela.review.pending.v1.${userId}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const pendingRatingStore = {
  async read(userId: string): Promise<PendingRating | null> {
    const key = keyFor(userId);
    const raw = Platform.OS === 'web' ? globalThis.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingRating;
    if (!value || !uuid.test(value.sessionId) || !uuid.test(value.wordId)
      || !uuid.test(value.clientRequestToken) || !ratings.includes(value.rating)) {
      throw new Error('Không đọc được lượt đánh giá đang lưu trên thiết bị.');
    }
    return value;
  },
  async save(userId: string, action: PendingRating) {
    const key = keyFor(userId);
    const payload = JSON.stringify(action);
    if (Platform.OS === 'web') globalThis.localStorage.setItem(key, payload);
    else await SecureStore.setItemAsync(key, payload);
  },
  async clear(userId: string) {
    const key = keyFor(userId);
    if (Platform.OS === 'web') globalThis.localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};

export function reviewError(error: unknown) {
  if (!(error instanceof ApiError)) return 'Chưa thể đồng bộ phiên ôn. Hãy thử lại.';
  switch (error.code) {
    case 'TIMEOUT': return 'Máy chủ phản hồi quá lâu. Hãy thử lại.';
    case 'NETWORK_ERROR': return 'Mất kết nối với máy chủ. Hãy kiểm tra mạng rồi thử lại.';
    case 'CARD_NOT_DUE': return 'Thẻ vẫn đang chờ đến lượt ôn tiếp theo.';
    case 'REQUEST_IN_PROGRESS': return 'Máy chủ đang xử lý lượt đánh giá này. Hãy thử lại.';
    case 'ITEM_NOT_CURRENT':
    case 'ITEM_ALREADY_COMPLETED':
    case 'SESSION_CLOSED': return 'Phiên ôn đã thay đổi. Tiến độ được tải lại từ máy chủ.';
    case 'SESSION_NOT_FOUND': return 'Không tìm thấy phiên ôn tập.';
    default: return error.status === 401 || error.status === 403
      ? 'Vui lòng đăng nhập lại để tiếp tục.' : error.message;
  }
}
