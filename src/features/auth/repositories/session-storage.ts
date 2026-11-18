import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { type AccessSession, isAccessSession } from './auth-repository';

const key = 'ela.auth.access.v1';

export const sessionStorage = {
  async read(): Promise<AccessSession | null> {
    if (Platform.OS === 'web') return null;
    const value = await SecureStore.getItemAsync(key);
    if (!value) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (isAccessSession(parsed)) return parsed;
    } catch {
      // Discard a malformed saved session.
    }
    await SecureStore.deleteItemAsync(key);
    return null;
  },
  async save(session: AccessSession) {
    if (Platform.OS !== 'web') await SecureStore.setItemAsync(key, JSON.stringify(session));
  },
  async clear() {
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(key);
  },
};
