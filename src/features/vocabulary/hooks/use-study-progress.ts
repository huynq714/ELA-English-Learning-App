import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useSession } from '@/features/auth/view-model/session-context';
import { quizRepository, type StudyProgress } from '@/features/quiz/quiz-repository';
import { ApiError } from '@/services/api-client';

export function useStudyProgress(deckId: string | undefined) {
  const { authenticated } = useSession();
  const [progress, setProgress] = useState<StudyProgress | null>(null);
  const [loading, setLoading] = useState(!!deckId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [pending, setPending] = useState(false);
  const [unsavedWordId, setUnsavedWordId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    if (!deckId) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      const value = await authenticated(token => quizRepository.loadProgress(token, deckId));
      if (version === loadVersion.current) setProgress(value);
    } catch (error) {
      if (version === loadVersion.current) {
        const unavailable = error instanceof ApiError && error.status === 404;
        setNotFound(unavailable);
        setLoadError(unavailable ? 'Bộ từ không còn được công bố.' : 'Chưa tải được tiến độ học.');
      }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [authenticated, deckId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { loadVersion.current++; };
  }, [load]));

  const study = async (wordId: string) => {
    if (!deckId || inFlight.current) return null;
    inFlight.current = true;
    setPending(true);
    try {
      const saved = await authenticated(token => quizRepository.study(token, deckId, wordId));
      setProgress(saved);
      setUnsavedWordId(null);
      return saved;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true);
        setLoadError('Bộ từ hoặc thẻ này không còn khả dụng.');
      } else {
        setUnsavedWordId(wordId);
      }
      return null;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return {
    progress, loading, loadError, notFound, pending, unsavedWordId, study,
    retryLoad: () => void load(),
  };
}
