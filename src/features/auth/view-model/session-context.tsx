import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/services/api-client';
import {
  authRepository, type AccessSession, type ChangePasswordInput, type CurrentUser, type LoginInput, type RegisterInput,
} from '../repositories/auth-repository';
import { sessionStorage } from '../repositories/session-storage';

type SessionState =
  | { status: 'restoring' }
  | { status: 'restore-error'; message: string }
  | { status: 'signed-out'; message?: string }
  | { status: 'signed-in'; session: AccessSession; user: CurrentUser };

type SessionViewModel = {
  state: SessionState;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  updateDisplayName: (userId: string, displayName: string) => void;
  logout: () => Promise<void>;
  retryRestore: () => void;
  authenticated: <T>(action: (token: string) => Promise<T>) => Promise<T>;
};

const SessionContext = createContext<SessionViewModel | null>(null);
const expiredMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
const sessionRejected = (error: unknown) => error instanceof ApiError && (error.status === 401 || error.status === 403);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ status: 'restoring' });
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const activeSession = useRef<AccessSession | null>(null);
  // Serialize storage changes so an old request cannot erase a newly saved session.
  const storageQueue = useRef<Promise<void>>(Promise.resolve());

  const queueStorage = useCallback((action: () => Promise<void>) => {
    const result = storageQueue.current.then(action);
    storageQueue.current = result.catch(() => {});
    return result;
  }, []);

  const expire = useCallback((session: AccessSession) => {
    if (activeSession.current !== session) return;
    activeSession.current = null;
    void queueStorage(sessionStorage.clear).catch(() => {});
    setState({ status: 'signed-out', message: expiredMessage });
  }, [queueStorage]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await sessionStorage.read();
        if (!active) return;
        if (!saved) {
          setState({ status: 'signed-out' });
          return;
        }
        if (Date.parse(saved.expiresAt) <= Date.now()) {
          await queueStorage(sessionStorage.clear);
          if (active) setState({ status: 'signed-out', message: expiredMessage });
          return;
        }
        const user = await authRepository.currentUser(saved.accessToken);
        if (active) {
          activeSession.current = saved;
          setState({ status: 'signed-in', session: saved, user });
        }
      } catch (error) {
        if (!active) return;
        if (sessionRejected(error)) {
          await queueStorage(sessionStorage.clear).catch(() => {});
          if (active) setState({ status: 'signed-out', message: expiredMessage });
        } else {
          setState({ status: 'restore-error', message: 'Chưa thể khôi phục phiên. Hãy kiểm tra kết nối rồi thử lại.' });
        }
      }
    })();
    return () => { active = false; };
  }, [restoreAttempt, queueStorage]);

  const session = state.status === 'signed-in' ? state.session : null;
  useEffect(() => {
    if (!session) return;
    const timeout = setTimeout(() => expire(session), Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    return () => clearTimeout(timeout);
  }, [session, expire]);

  const saveSession = useCallback(async ({ accessToken, expiresAt, user }: AccessSession & { user: CurrentUser }) => {
    const nextSession = { accessToken, expiresAt };
    await queueStorage(() => sessionStorage.save(nextSession));
    activeSession.current = nextSession;
    setState({ status: 'signed-in', session: nextSession, user });
  }, [queueStorage]);

  const login = useCallback(async (input: LoginInput) => {
    await saveSession(await authRepository.login(input));
  }, [saveSession]);

  const register = useCallback(async (input: RegisterInput) => {
    await saveSession(await authRepository.register(input));
  }, [saveSession]);

  const updateDisplayName = useCallback((userId: string, displayName: string) => {
    setState(previous => previous.status === 'signed-in' && previous.user.id === userId
      ? { ...previous, user: { ...previous.user, displayName } }
      : previous);
  }, []);

  const logout = useCallback(async () => {
    await queueStorage(sessionStorage.clear);
    activeSession.current = null;
    setState({ status: 'signed-out' });
  }, [queueStorage]);

  const retryRestore = useCallback(() => {
    setState({ status: 'restoring' });
    setRestoreAttempt(value => value + 1);
  }, []);

  const authenticated = useCallback(async <T,>(action: (token: string) => Promise<T>) => {
    const session = activeSession.current;
    if (!session) throw new ApiError(expiredMessage, 401);
    if (Date.parse(session.expiresAt) <= Date.now()) {
      expire(session);
      throw new ApiError(expiredMessage, 401);
    }
    try {
      return await action(session.accessToken);
    } catch (error) {
      if (sessionRejected(error)) expire(session);
      throw error;
    }
  }, [expire]);

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    const next = await authenticated(token => authRepository.changePassword(token, input));
    await saveSession(next);
  }, [authenticated, saveSession]);

  return <SessionContext.Provider value={{ state, login, register, changePassword, updateDisplayName, logout, retryRestore, authenticated }}>
    {children}
  </SessionContext.Provider>;
}

export function useSession() {
  const model = useContext(SessionContext);
  if (!model) throw new Error('SessionProvider is required');
  return model;
}
