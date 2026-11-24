import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useSession } from '@/features/auth/view-model/session-context';
import type { ReviewSummary } from './models';
import { pendingRatingStore, reviewError, reviewRepository } from './repository';

export function useReviewSummary() {
  const { authenticated, state } = useSession();
  const userId = state.status === 'signed-in' ? state.user.id : null;
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latestAttempt = useRef(0);

  useFocusEffect(useCallback(() => {
    if (!userId) {
      setSummary(null);
      setPendingSessionId(null);
      setError(null);
      return;
    }
    let current = true;
    setSummary(null);
    setError(null);
    void Promise.all([authenticated(reviewRepository.summary), pendingRatingStore.read(userId)]).then(([value, pending]) => {
      if (current && latestAttempt.current === attempt) {
        setSummary(value); setPendingSessionId(pending?.sessionId ?? null); setError(null);
      }
    }, failure => {
      if (current && latestAttempt.current === attempt) setError(reviewError(failure));
    });
    return () => { current = false; };
  }, [authenticated, userId, attempt]));

  return { summary, pendingSessionId, error, reload: () => {
    setError(null);
    setAttempt(++latestAttempt.current);
  } };
}
