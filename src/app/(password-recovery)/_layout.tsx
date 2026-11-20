import { Stack } from 'expo-router';

import { PasswordRecoveryProvider } from '@/features/auth/view-model/password-recovery';

export default function PasswordRecoveryLayout() {
  return <PasswordRecoveryProvider><Stack screenOptions={{ headerShown: false }} /></PasswordRecoveryProvider>;
}
