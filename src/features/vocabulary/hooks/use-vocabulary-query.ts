import { useCallback, useEffect, useState } from 'react';

import { useSession } from '@/features/auth/view-model/session-context';
import { ApiError } from '@/services/api-client';

type Result<T> = { key: string; attempt: number; data?: T; error?: ApiError };

export function useVocabularyQuery<T>(resource: string | undefined, load: (token: string) => Promise<T>) {
  const { authenticated, state } = useSession();
  const key = resource && state.status === 'signed-in'
    ? `${state.user.id}:${state.profileLevel ?? ''}:${resource}`
    : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const refresh = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    if (key === null) return;
    let active = true;
    void authenticated(load).then(
      data => {
        if (active) setResult({ key, attempt, data });
      },
      reason => {
        if (!active) return;
        const error = reason instanceof ApiError
          ? reason
          : new ApiError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu từ vựng.');
        setResult({ key, attempt, error });
      },
    );
    return () => { active = false; };
  }, [authenticated, key, load, attempt]);

  const current = result?.key === key ? result : null;
  const isRefreshing = current !== null && current.attempt !== attempt;
  return {
    data: current?.data,
    error: isRefreshing ? undefined : current?.error,
    isLoading: key !== null && current === null,
    isRefreshing,
    refresh,
  };
}
