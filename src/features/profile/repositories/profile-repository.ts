import { apiClient } from '@/services/api-client';

import type { EnglishLevel } from '../models/english-level';

export type UserProfile = {
  userId: string;
  displayName: string;
  englishLevel: EnglishLevel;
  dailyGoalMinutes: number;
  avatarUrl: string | null;
  updatedAt: string;
};

type ProfileChanges = { displayName: string; englishLevel: EnglishLevel; dailyGoalMinutes: number; avatarUrl?: string };

const path = '/api/v1/users/me/profile';
export const profileRepository = {
  load: (token: string) => apiClient.get<UserProfile>(path, token),
  save: (token: string, changes: ProfileChanges) => apiClient.patch<UserProfile>(path, changes, token),
};
