import type { Word } from '@/features/vocabulary/models/word';

export const ratings = ['AGAIN', 'HARD', 'GOOD', 'EASY'] as const;
export type Rating = typeof ratings[number];
export type SessionType = 'DUE' | 'CRAM';

export type ReviewSummary = {
  learnedCount: number;
  dueCount: number;
  cramCount: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  relearningCount: number;
  currentStreak: number;
  longestStreak: number;
  totalCards: number;
  activeSessionId: string | null;
};

export type ReviewSession = {
  sessionId: string | null;
  type: SessionType;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | null;
  targetCount: number;
  completedCount: number;
  pendingCount: number;
  nextWordId: string | null;
  nextDueAt: string | null;
  waiting: boolean;
  empty: boolean;
  items: { wordId: string; againCount: number; dueAt: string }[];
};

export type ReviewSessionData = { session: ReviewSession; words: Word[] };
export type PendingRating = { sessionId: string; wordId: string; rating: Rating; clientRequestToken: string };
