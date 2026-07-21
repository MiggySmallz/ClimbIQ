import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNavigator() {
  const { session } = useAuth();

  useEffect(() => {
    // session === undefined means the initial auth load is still in flight.
    if (session !== undefined) SplashScreen.hideAsync();
  }, [session]);

  if (session === undefined) return null; // splash stays visible

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="climb-form" options={{ presentation: 'modal', headerShown: true }} />
      <Stack.Screen name="friends" options={{ headerShown: true, title: 'Friends' }} />
      <Stack.Screen name="report/[id]" options={{ headerShown: true, title: 'Report' }} />
      <Stack.Screen
        name="analyze/record"
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
      <Stack.Screen name="analyze/trim" options={{ headerShown: true, title: 'Trim clip' }} />
      <Stack.Screen name="analyze/status" options={{ headerShown: true, title: 'Analysis' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
