import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DemoNoticeProvider } from '@/components/demo-notice';
import { AppText, PrimaryButton, Screen } from '@/components/ui';
import { SessionProvider, useSession } from '@/features/auth/view-model/session-context';
import { colors } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Inter-Regular': require('../../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../../assets/fonts/Inter-Bold.ttf'),
    'Inter-ExtraBold': require('../../assets/fonts/Inter-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (error) throw error;
  if (!loaded) return null;

  return <SafeAreaProvider>
    <DemoNoticeProvider>
      <StatusBar style="dark" />
      <SessionProvider><AppNavigator /></SessionProvider>
    </DemoNoticeProvider>
  </SafeAreaProvider>;
}

function AppNavigator() {
  const { state, retryRestore } = useSession();
  if (state.status === 'restoring') {
    return <Screen testID="session-restoring" contentStyle={{ padding: 24 }}>
      <AppText color={colors.muted}>Đang khôi phục phiên…</AppText>
    </Screen>;
  }
  if (state.status === 'restore-error') {
    return <Screen testID="session-restore-error" contentStyle={{ padding: 24, gap: 16 }}>
      <AppText accessibilityRole="alert" color={colors.error}>{state.message}</AppText>
      <PrimaryButton title="Thử lại" onPress={retryRestore} />
    </Screen>;
  }
  const signedIn = state.status === 'signed-in';
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.screen } }}>
    <Stack.Protected guard={!signedIn} redirectTo="/home">
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(password-recovery)" />
    </Stack.Protected>
    <Stack.Protected guard={signedIn}>
      <Stack.Screen name="home" />
      <Stack.Screen name="vocabulary" />
      <Stack.Screen name="my-vocabulary" />
      <Stack.Screen name="my-vocabulary/[groupId]" />
      <Stack.Screen name="saved-flashcards" />
      <Stack.Screen name="flashcard" />
      <Stack.Screen name="quiz" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="review" />
      <Stack.Screen name="ipa" />
      <Stack.Screen name="ai" />
    </Stack.Protected>
  </Stack>;
}
