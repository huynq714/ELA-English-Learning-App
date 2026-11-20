import { createContext, type ReactNode, useContext, useRef, useState } from 'react';

import { ApiError, apiClient } from '@/services/api-client';

type Challenge = { email: string; resendAt: number; resetToken?: string };
type RecoveryStep = 'email' | 'otp' | 'password';

const recoveryPath = '/api/v1/auth';
const errors: Record<string, string> = {
  RESET_UNAVAILABLE: 'Tính năng khôi phục mật khẩu hiện chưa khả dụng.',
  RESET_RATE_LIMIT: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.',
  INVALID_RESET_OTP: 'Mã OTP không hợp lệ hoặc đã hết hạn. Hãy kiểm tra mã hoặc yêu cầu gửi lại.',
  INVALID_RESET_TOKEN: 'Yêu cầu đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
  SAME_PASSWORD: 'Hãy chọn mật khẩu khác mật khẩu hiện tại.',
  INVALID_PASSWORD: 'Mật khẩu cần có chữ, số và dài từ 8 ký tự đến tối đa 72 byte.',
  PASSWORD_MISMATCH: 'Mật khẩu xác nhận chưa khớp.',
};

function usePasswordRecoveryState() {
  const [challenge, setChallenge] = useState<Challenge>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ step: RecoveryStep; message: string }>();
  const submitting = useRef(false);

  async function submit(step: RecoveryStep, action: () => Promise<void>): Promise<boolean> {
    if (submitting.current) return false;
    submitting.current = true;
    setPending(true);
    setError(undefined);
    try {
      await action();
      return true;
    } catch (cause) {
      const message = cause instanceof ApiError
        ? (cause.code && errors[cause.code]) || (!cause.status && cause.message)
        : undefined;
      setError({ step, message: message || 'Yêu cầu chưa thực hiện được. Vui lòng thử lại.' });
      return false;
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return {
    challenge, pending, error,
    clearError: () => setError(undefined),
    clear: () => { setChallenge(undefined); setError(undefined); },
    requestCode: (address: string, step: 'email' | 'otp' = 'email') => submit(step, async () => {
      const email = address.trim().toLowerCase();
      await apiClient.post<void>(`${recoveryPath}/forgot-password`, { email });
      setChallenge({ email, resendAt: Date.now() + 60_000 });
    }),
    verifyCode: (otp: string) => submit('otp', async () => {
      if (!challenge) return;
      const { resetToken } = await apiClient.post<{ resetToken: string }>(`${recoveryPath}/verify-reset-otp`,
        { email: challenge.email, otp });
      setChallenge({ ...challenge, resetToken });
    }),
    resetPassword: (newPassword: string, confirmPassword: string) => submit('password', async () => {
      if (!challenge?.resetToken) return;
      await apiClient.post<void>(`${recoveryPath}/reset-password`,
        { email: challenge.email, resetToken: challenge.resetToken, newPassword, confirmPassword });
    }),
  };
}

const RecoveryContext = createContext<ReturnType<typeof usePasswordRecoveryState> | null>(null);

export function PasswordRecoveryProvider({ children }: { children: ReactNode }) {
  const value = usePasswordRecoveryState();
  return <RecoveryContext.Provider value={value}>{children}</RecoveryContext.Provider>;
}

export function usePasswordRecovery() {
  const recovery = useContext(RecoveryContext);
  if (!recovery) throw new Error('PasswordRecoveryProvider is missing.');
  return recovery;
}
