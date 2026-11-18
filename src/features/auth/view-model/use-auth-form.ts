import { useRef, useState } from 'react';

import { ApiError } from '@/services/api-client';
import { validateNewPassword } from './password-validation';
import { useSession } from './session-context';

export function useAuthForm(mode: 'login' | 'register') {
  const { login, register } = useSession();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const submit = async () => {
    if (inFlight.current) return false;
    const address = email.trim();
    const name = displayName.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 255) {
      setError('Vui lòng nhập email hợp lệ.');
      return false;
    }
    if (mode === 'register' && (!name || name.length > 100)) {
      setError('Vui lòng nhập tên hiển thị từ 1 đến 100 ký tự.');
      return false;
    }
    if (!password.trim() || password.length > 72) {
      setError('Vui lòng nhập mật khẩu hợp lệ.');
      return false;
    }
    const passwordError = mode === 'register' ? validateNewPassword(password, confirmPassword) : null;
    if (passwordError) {
      setError(passwordError);
      return false;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      if (mode === 'register') await register({ email: address, displayName: name, password, confirmPassword });
      else await login({ email: address, password });
      setPassword('');
      setConfirmPassword('');
      return true;
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) setError('Email hoặc mật khẩu không đúng.');
      else if (failure instanceof ApiError && failure.status === 409) setError('Email này đã có tài khoản.');
      else setError(failure instanceof Error ? failure.message : 'Có lỗi xảy ra. Vui lòng thử lại.');
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return { email, setEmail, displayName, setDisplayName, password, setPassword, confirmPassword, setConfirmPassword,
    pending, error, submit };
}
