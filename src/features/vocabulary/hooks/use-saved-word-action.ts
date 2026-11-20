import { useRef, useState } from 'react';

import { useSession } from '@/features/auth/view-model/session-context';
import { ApiError } from '@/services/api-client';
import { savedWordRepository } from '../repositories/saved-word-repository';

export function useSavedWordAction() {
  const { authenticated } = useSession();
  const [pendingId, setPendingId] = useState<string>();
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);

  async function change(id: string, save: boolean): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setPendingId(id);
    setError(undefined);
    try {
      await authenticated(token => save ? savedWordRepository.save(token, id) : savedWordRepository.remove(token, id));
      return true;
    } catch (reason) {
      if (reason instanceof ApiError && !reason.status) {
        // A lost response can follow a successful write. Only trust confirmed server state.
        try {
          const status = await authenticated(token => savedWordRepository.status(token, id));
          if (status.saved === save) return true;
        } catch {
          // Keep the previously confirmed state.
        }
      }
      setError(reason instanceof ApiError && reason.status === 404
        ? 'Từ này nằm ngoài các bộ bạn có thể lưu.'
        : 'Chưa xác nhận được thay đổi. Hãy kiểm tra mạng và thử lại.');
      return false;
    } finally {
      inFlight.current = false;
      setPendingId(undefined);
    }
  }

  return { pendingId, error, change };
}
