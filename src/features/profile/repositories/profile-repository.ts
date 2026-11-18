import { apiClient } from '@/services/api-client';

export const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type EnglishLevel = typeof levels[number];

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
