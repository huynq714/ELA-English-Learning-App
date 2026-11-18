import { useRef, useState } from 'react';

import type { EnglishLevel } from '@/features/profile/models/english-level';
import { ApiError } from '@/services/api-client';
import type { RegisterInput } from '../repositories/auth-repository';
import { validateNewPassword } from './password-validation';
import { useSession } from './session-context';

const levelRequired = 'Vui lòng chọn trình độ tiếng Anh.';

export function useAuthForm(mode: 'login' | 'register') {
  const { login, register } = useSession();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const selectEnglishLevel = (level: EnglishLevel) => {
    setEnglishLevel(level);
    setError(current => current === levelRequired ? null : current);
  };

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
    let registration: RegisterInput | undefined;
    if (mode === 'register') {
      if (!englishLevel) {
        setError(levelRequired);
        return false;
      }
      const passwordError = validateNewPassword(password, confirmPassword);
      if (passwordError) {
        setError(passwordError);
        return false;
      }
      registration = { email: address, displayName: name, password, confirmPassword, englishLevel };
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      if (registration) await register(registration);
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
    englishLevel, selectEnglishLevel, pending, error, submit };
}
