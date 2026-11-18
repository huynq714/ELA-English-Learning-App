import { apiClient } from '@/services/api-client';

export type QuizQuestion = { questionNo: number; prompt: string; options: string[] };
export type AnswerFeedback = { questionNo: number; selectedOption: number; correctOption: number; correct: boolean };
export type Quiz = {
  attemptId: string;
  direction: 'EN_TO_VI' | 'VI_TO_EN';
  questions: QuizQuestion[];
  answered: AnswerFeedback[];
};
export type QuizResult = {
  attemptId: string;
  deckId: string;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
};
export type Selection = { questionNo: number; optionIndex: number };
export type StudyProgress = {
  lastStudiedWordId: string | null;
  unstudiedWordIds: string[];
  remainingReviewWordIds: string[];
};

const attempts = '/api/v1/quiz/attempts';
const progressPath = (deckId: string) => `/api/v1/decks/${encodeURIComponent(deckId)}/study-progress`;

export const quizRepository = {
  start: (token: string, deckId: string) => apiClient.post<Quiz>(attempts, { deckId }, token),
  answer: (token: string, attemptId: string, selection: Selection) =>
    apiClient.post<AnswerFeedback>(`${attempts}/${encodeURIComponent(attemptId)}/answers`, selection, token),
  submit: (token: string, attemptId: string, answers: Selection[]) =>
    apiClient.post<QuizResult>(`${attempts}/${encodeURIComponent(attemptId)}/submit`, { answers }, token),
  loadProgress: (token: string, deckId: string) => apiClient.get<StudyProgress>(progressPath(deckId), token),
  study: (token: string, deckId: string, wordId: string) =>
    apiClient.post<StudyProgress>(progressPath(deckId), { wordId }, token),
};
