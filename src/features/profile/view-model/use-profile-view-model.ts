import { useEffect, useRef, useState } from 'react';

import { useSession } from '@/features/auth/view-model/session-context';
import { ApiError } from '@/services/api-client';
import type { EnglishLevel } from '../models/english-level';
import { pickAvatar } from '../repositories/avatar-picker';
import { profileRepository } from '../repositories/profile-repository';

export function useProfileViewModel() {
  const { authenticated, logout, state, updateProfile } = useSession();
  const [displayName, setDisplayName] = useState(state.status === 'signed-in' ? state.user.displayName : '');
  const [savedAvatar, setSavedAvatar] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [level, setLevel] = useState<EnglishLevel>('A1');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'avatar' | 'save' | 'logout' | null>(null);
  const [revision, setRevision] = useState(0);
  const actionInProgress = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await authenticated(profileRepository.load);
        if (!active) return;
        setDisplayName(loaded.displayName);
        setSavedAvatar(loaded.avatarUrl);
        setLevel(loaded.englishLevel);
        setEmpty(false);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 404) {
          setEmpty(true);
        } else {
          setLoadError('Không tải được hồ sơ. Hãy kiểm tra kết nối và thử lại.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [authenticated, revision]);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setRevision(value => value + 1);
  };

  const selectAvatar = async () => {
    if (actionInProgress.current || loading || loadError) return;
    actionInProgress.current = true;
    setBusy('avatar');
    try {
      const next = await pickAvatar();
      if (next) {
        setSelectedAvatar(next);
        setActionError(null);
      }
    } catch {
      setActionError('Chưa đọc được ảnh. Hãy thử chọn một ảnh khác.');
    } finally {
      actionInProgress.current = false;
      setBusy(null);
    }
  };

  const save = async () => {
    if (actionInProgress.current || loading || loadError) return false;
    const name = displayName.trim();
    if (!name || name.length > 100) {
      setActionError('Tên hiển thị cần từ 1 đến 100 ký tự.');
      return false;
    }
    actionInProgress.current = true;
    setBusy('save');
    setActionError(null);
    try {
      const saved = await authenticated(token => profileRepository.save(token, {
        displayName: name, englishLevel: level,
        ...(selectedAvatar ? { avatarUrl: selectedAvatar } : {}),
      }));
      setDisplayName(saved.displayName);
      updateProfile(saved.userId, saved.displayName, saved.englishLevel);
      setSavedAvatar(saved.avatarUrl);
      setSelectedAvatar(null);
      setLevel(saved.englishLevel);
      setEmpty(false);
      return true;
    } catch {
      setActionError('Chưa lưu được hồ sơ. Hãy thử lại.');
      return false;
    } finally {
      actionInProgress.current = false;
      setBusy(null);
    }
  };

  const signOut = async () => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setBusy('logout');
    try {
      await logout();
    } catch {
      setActionError('Chưa xóa được phiên trên thiết bị. Hãy thử đăng xuất lại.');
    } finally {
      actionInProgress.current = false;
      setBusy(null);
    }
  };

  return {
    displayName, setDisplayName, avatar: selectedAvatar ?? savedAvatar, selectAvatar,
    level, setLevel, loading, loadError, retry, empty, actionError, busy, save, signOut,
  };
}
