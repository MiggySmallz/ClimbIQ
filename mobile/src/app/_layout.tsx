import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fontMap } from '@/constants/fonts';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useTheme } from '@/hooks/use-theme';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNavigator() {
  const { session } = useAuth();
  const theme = useTheme();
  usePushNotifications();

  useEffect(() => {
    // session === undefined means the initial auth load is still in flight.
    if (session !== undefined) SplashScreen.hideAsync();
  }, [session]);

  if (session === undefined) return null; // splash stays visible

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="climb-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="friends" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="admin/credits" />
        <Stack.Screen name="admin/usage" />
        <Stack.Screen name="report/[id]" />
        <Stack.Screen name="analyze/record" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="analyze/trim" />
        <Stack.Screen name="analyze/status" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontMap);

  if (!fontsLoaded) return null; // splash stays visible until fonts are ready

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
