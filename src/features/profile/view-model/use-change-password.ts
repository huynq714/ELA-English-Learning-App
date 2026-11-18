import { useRef, useState } from 'react';

import { useSession } from '@/features/auth/view-model/session-context';
import { validateNewPassword } from '@/features/auth/view-model/password-validation';
import { ApiError } from '@/services/api-client';

export function useChangePassword() {
  const { changePassword } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const submit = async () => {
    if (inFlight.current) return false;
    const validation = !currentPassword ? 'Vui lòng nhập mật khẩu cũ.'
      : validateNewPassword(newPassword, confirmPassword)
      ?? (newPassword === currentPassword ? 'Mật khẩu mới phải khác mật khẩu hiện tại.' : null);
    if (validation) {
      setError(validation);
      return false;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      return true;
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.code : undefined;
      const messages: Record<string, string> = {
        INCORRECT_PASSWORD: 'Mật khẩu cũ không đúng.',
        PASSWORD_MISMATCH: 'Mật khẩu xác nhận chưa khớp.',
        SAME_PASSWORD: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
        INVALID_PASSWORD: 'Mật khẩu cần ít nhất 8 ký tự, có chữ và số, tối đa 72 byte.',
      };
      setError((code && messages[code]) || 'Chưa đổi được mật khẩu. Hãy thử lại.');
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return { currentPassword, setCurrentPassword, newPassword, setNewPassword, confirmPassword, setConfirmPassword,
    error, pending, submit };
}
