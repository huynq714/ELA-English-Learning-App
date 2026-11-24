import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/features/auth/view-model/session-context';
import { ApiError } from '@/services/api-client';
import type { PendingRating, Rating, ReviewSessionData } from './models';
import { pendingRatingStore, reviewError, reviewRepository } from './repository';

function definitivelyRejected(error: unknown) {
  return error instanceof ApiError && error.status !== undefined
    && [400, 404, 409, 422].includes(error.status) && error.code !== 'REQUEST_IN_PROGRESS';
}

export function useReviewSession(sessionId: string) {
  const { state, authenticated } = useSession();
  const userId = state.status === 'signed-in' ? state.user.id : null;
  const busy = useRef(false);
  const generation = useRef(0);
  const [data, setData] = useState<ReviewSessionData | null>(null);
  const [pending, setPending] = useState<PendingRating | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (request?: { wordId: string; rating: Rating } | 'retry') => {
    if (!userId || busy.current) return;
    busy.current = true;
    const current = generation.current;
    const alive = () => generation.current === current;
    setLoading(true);
    setError(null);
    let action: PendingRating | null = null;
    try {
      action = await pendingRatingStore.read(userId);
      if (action && action.sessionId !== sessionId) {
        throw new Error('Hãy quay lại phiên có lượt đánh giá đang chờ.');
      }
      if (alive()) setPending(action);
      let ratingError: unknown;
      if (request) {
        if (!action) {
          if (request === 'retry') return;
          const next = { sessionId, ...request, clientRequestToken: randomUUID() };
          await pendingRatingStore.save(userId, next);
          action = next;
          if (alive()) setPending(action);
        }
        const savedAction = action;
        try {
          await authenticated(token => reviewRepository.rate(savedAction, token));
        } catch (failure) {
          ratingError = failure;
          if (!definitivelyRejected(failure)) {
            if (alive()) setError(reviewError(failure));
          }
        }
        if (!ratingError || definitivelyRejected(ratingError)) {
          await pendingRatingStore.clear(userId);
          if (alive()) setPending(null);
        }
      }
      const latest = await authenticated(token => reviewRepository.session(sessionId, token));
      if (alive()) {
        setData(latest);
        if (ratingError) setError(reviewError(ratingError));
      }
    } catch (failure) {
      if (alive()) setError(reviewError(failure));
    } finally {
      busy.current = false;
      if (alive()) setLoading(false);
    }
  }, [authenticated, sessionId, userId]);

  const reload = useCallback(() => { void run(); }, [run]);
  useFocusEffect(useCallback(() => {
    reload();
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') reload(); });
    return () => subscription.remove();
  }, [reload]));
  useEffect(() => () => { generation.current++; }, []);

  const waitingUntil = data?.session.waiting && data.session.nextDueAt ? data.session.nextDueAt : null;
  useEffect(() => {
    if (loading || (!waitingUntil && !error)) return;
    const delay = waitingUntil && !error ? Math.max(250, Date.parse(waitingUntil) - Date.now() + 250) : 5000;
    const timer = setTimeout(reload, Math.min(delay, 30000));
    return () => clearTimeout(timer);
  }, [loading, waitingUntil, error, reload]);

  const rate = (rating: Rating) => {
    const session = data?.session;
    if (session?.status === 'IN_PROGRESS' && !session.waiting && session.nextWordId && !pending) {
      void run({ wordId: session.nextWordId, rating });
    }
  };
  return { data, pending, loading, error, reload, rate, retryRating: () => void run('retry') };
}
