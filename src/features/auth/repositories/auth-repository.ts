import type { EnglishLevel } from '@/features/profile/models/english-level';
import { apiClient } from '@/services/api-client';

export type CurrentUser = { id: string; email: string; displayName: string };
export type AccessSession = { accessToken: string; expiresAt: string };
export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { displayName: string; confirmPassword: string; englishLevel: EnglishLevel };
export type ChangePasswordInput = { currentPassword: string; newPassword: string; confirmPassword: string };
type SessionResponse = AccessSession & { user: CurrentUser };

export function isAccessSession(value: unknown): value is AccessSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AccessSession>;
  return typeof session.accessToken === 'string' && session.accessToken.length > 0
    && typeof session.expiresAt === 'string' && Number.isFinite(Date.parse(session.expiresAt));
}

async function readSession(response: Promise<SessionResponse>): Promise<SessionResponse> {
  const session = await response;
  if (!isAccessSession(session) || Date.parse(session.expiresAt) <= Date.now()
    || !session.user || typeof session.user.id !== 'string' || typeof session.user.email !== 'string'
    || typeof session.user.displayName !== 'string') {
    throw new Error('Máy chủ không trả về phiên đăng nhập hợp lệ.');
  }
  return session;
}

export const authRepository = {
  register: (input: RegisterInput) => readSession(apiClient.post<SessionResponse>('/api/v1/auth/register', input)),
  login: (input: LoginInput) => readSession(apiClient.post<SessionResponse>('/api/v1/auth/login', input)),
  changePassword: (token: string, input: ChangePasswordInput) =>
    readSession(apiClient.patch<SessionResponse>('/api/v1/users/me/password', input, token)),
  currentUser: (token: string) => apiClient.get<CurrentUser>('/api/v1/users/me', token),
};
